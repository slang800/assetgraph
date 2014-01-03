util = require("util")
fs = require("fs")
os = require("os")
childProcess = require("child_process")
_ = require("underscore")
EventEmitter = require("events").EventEmitter
seq = require("seq")
Path = require("path")
passError = require("passerror")
urlTools = require("url-tools")
TransformQueue = require("./TransformQueue")

setImmediate = process.nextTick if typeof setImmediate is "undefined"

class AssetGraph extends EventEmitter
  resolvers: require("./resolvers")
  
  query: require("./query")
  
  _assets: []
  _relations: []
  _objInBaseAssetPaths: {}
  _relationsWithNoBaseAsset: []
  idIndex: {}

  ###
  new AssetGraph([options])
  =========================

  Create a new AssetGraph instance.

  Options:

  - `root` (optional) The root URL of the graph, either as a fully
  qualified `file:` or `http:` url or file system
  path. Defaults to the current directory,
  ie. `file://<process.cwd()>/`. The purpose of the root
  option is to allow resolution of root-relative urls
  (eg. `<a href="/foo.html">`) from `file:` locations.
  - `dieOnError` (optional) Whether to throw an exception or keep
  going when any error is encountered. Defaults to false.

  Examples:

  new AssetGraph()
  // => root: "file:///current/working/dir/"

  new AssetGraph({root: '/absolute/fs/path'});
  // => root: "file:///absolute/fs/path/"

  new AssetGraph({root: 'relative/path'})
  // => root: "file:///current/working/dir/relative/path/"

  @constructor AssetGraph
  @param {Object} options
  @api public
  ###
  constructor: (options) ->
    _.extend this, options
    
    # this.root might be undefined, in which case urlTools.urlOrFsPathToUrl
    # will use process.cwd()
    @root = urlTools.urlOrFsPathToUrl(@root, true) # ensureTrailingSlash
    @resolverByProtocol =
      data: @resolvers.data()
      file: @resolvers.file()
      javascript: @resolvers.javascript()
      http: @resolvers.http()
      https: @resolvers.http()

    unless @dieOnError
      @on "error", ->

    that = @
    fs.readdirSync(Path.resolve(__dirname, "transforms")).forEach (fileName) ->
      that.registerTransform Path.resolve(__dirname, "transforms", fileName)

    fs.readdirSync(Path.resolve(__dirname, "assets")).forEach (fileName) ->
      if /\.js$/.test(fileName) and fileName isnt "index.js"
        that.registerAsset require(Path.resolve(__dirname, "assets", fileName))

    fs.readdirSync(Path.resolve(__dirname, "relations")).forEach (fileName) ->
      if /\.js$/.test(fileName) and fileName isnt "index.js"
        that.registerRelation Path.resolve(__dirname, "relations", fileName)

  typeByExtension: {}

  typeByContentType: {}

  lookupContentType: (contentType) ->
    if contentType
      # Trim whitespace and semicolon suffixes such as ;charset=...
      contentType = contentType.match(/^\s*([^;\s]*)(?:;|\s|$)/)[1].toLowerCase() # Will always match
      if contentType of @typeByContentType
        @typeByContentType[contentType]
      else if /\+xml$/i.test(contentType)
        "Xml"
      else if /^text\//i.test(contentType)
        "Text"
      else
        "Asset"

  createAsset: (assetConfig) ->
    unless assetConfig.type
      throw new Error("AssetGraph.create: No type provided in assetConfig" + util.inspect(assetConfig))
    if assetConfig.isAsset
      assetConfig
    else
      new @[assetConfig.type](assetConfig)

  ###
  assetGraph.root
  ===============
  
  The absolute root url of the graph, always includes a trailing
  slash. A normalized version of the `root` option provided to
  the constructor.
  ###
  
  ###
  Avoid instanceof checks:
  ###
  isAssetGraph: true
  
  ###
  assetGraph.addAsset(asset)
  ==========================
  
  Add an asset to the graph.
  
  @param {Asset} asset The asset to add.
  @return {AssetGraph} The AssetGraph instance (chaining-friendly).
  @api public
  ###
  addAsset: (asset) ->
    if Array.isArray(asset)
      asset.forEach ((_asset) ->
        @addAsset _asset
      ), this
      return
    if not asset or typeof asset isnt "object"
      throw new Error("AssetGraph.addAsset: #{asset} is not an asset or an asset config object")
    asset = @createAsset(asset)  unless asset.isAsset
    if asset.id of @idIndex
      throw new Error("AssetGraph.addAsset: #{asset} is already in graph (id already in idIndex)")
    @idIndex[asset.id] = asset
    @_assets.push asset
    @_objInBaseAssetPaths[asset.id] = []
    asset.assetGraph = this
    asset.isPopulated = false
    @emit "addAsset", asset
    asset.populate()
    this

  ###
  assetGraph.removeAsset(asset[, detachIncomingRelations])
  ========================================================
  
  Remove an asset from the graph. Also removes the incoming and
  outgoing relations of the asset.
  
  @param {Asset} asset The asset to remove.
  @param {Boolean} detachIncomingRelations Whether to also detach the incoming
      relations before removal (defaults to false).
  @return {AssetGraph} The AssetGraph instance (chaining-friendly).
  ###
  removeAsset: (asset, detachIncomingRelations) ->
    unless asset.id of @idIndex
      throw new Error("AssetGraph.removeAsset: #{asset} not in graph")
    asset._outgoingRelations = @findRelations(
      from: asset
    , true)
    asset._outgoingRelations.forEach ((outgoingRelation) ->
      @removeRelation outgoingRelation
      
      # Remove inline asset
      if outgoingRelation.to.isAsset and outgoingRelation.to.isInline
        @removeAsset outgoingRelation.to
    ), this
    @findRelations(to: asset).forEach ((incomingRelation) ->
      if detachIncomingRelations
        incomingRelation.detach()
      else
        incomingRelation.remove()
    ), this
    affectedRelations = [].concat(@_objInBaseAssetPaths[asset.id])
    affectedRelations.forEach ((affectedRelation) ->
      affectedRelation._unregisterBaseAssetPath()
    ), this
    delete @_objInBaseAssetPaths[asset.id]

    assetIndex = @_assets.indexOf(asset)
    if assetIndex is -1
      throw new Error("removeAsset: #{asset} not in graph")
    else
      @_assets.splice assetIndex, 1
    delete @idIndex[asset.id]

    affectedRelations.forEach ((affectedRelation) ->
      affectedRelation._registerBaseAssetPath()
    ), this
    delete asset.assetGraph

    @emit "removeAsset", asset
    this

  ###
  assetGraph.addRelation(relation, position[, adjacentRelation])
  ==============================================================
  
  Add a relation to the graph.
  
  The ordering of certain relation types is significant
  (`HtmlScript`, for instance), so it's important that the order
  isn't scrambled in the indices. Therefore the caller must
  explicitly specify a position at which to insert the object.
  
  @param {Relation} relation The relation to add to the graph.
  @param {String} position "first", "last", "before", or "after".
  @param {Relation} adjacentRelation The adjacent relation, mandatory if
      position is "before" or "after".
  @return {AssetGraph} The AssetGraph instance (chaining-friendly).
  @api private
  ###
  addRelation: (relation, position, adjacentRelation) -> # position and adjacentRelation are optional
    if Array.isArray(relation)
      relation.forEach ((_relation) ->
        @addRelation _relation, position, adjacentRelation
      ), this
      return
    if not relation or not relation.id or not relation.isRelation
      throw new Error("AssetGraph.addRelation: Not a relation: " + relation)
    if relation.id of @idIndex
      throw new Error("AssetGraph.addRelation: Relation already in graph: " + relation)
    if not relation.from or not relation.from.isAsset
      throw new Error("AssetGraph.addRelation: 'from' property of relation is not an asset: " + relation.from)
    unless relation.from.id of @idIndex
      throw new Error("AssetGraph.addRelation: 'from' property of relation is not in the graph: " + relation.from)
    unless relation.to
      throw new Error("AssetGraph.addRelation: 'to' property of relation is missing")
    position = position or "last"
    relation.assetGraph = this
    if position is "last"
      @_relations.push relation
    else if position is "first"
      @_relations.unshift relation
    else if position is "before" or position is "after" # Assume 'before' or 'after'
      if not adjacentRelation or not adjacentRelation.isRelation
        throw new Error("AssetGraph.addRelation: Adjacent relation is not a relation: " + adjacentRelation)
      i = @_relations.indexOf(adjacentRelation) + ((if position is "after" then 1 else 0))
      if i is -1
        throw new Error("AssetGraph.addRelation: Adjacent relation is not in the graph: " + adjacentRelation)
      @_relations.splice i, 0, relation
    else
      throw new Error("AssetGraph.addRelation: Illegal 'position' argument: " + position)
    @idIndex[relation.id] = relation
    @_objInBaseAssetPaths[relation.id] = []
    relation._registerBaseAssetPath()
    @emit "addRelation", relation
    this

  ###
  assetGraph.removeRelation(relation)
  ===================================
  
  Remove a relation from the graph. Leaves the relation attached
  to the source asset.
  
  @param {Relation} relation The relation to remove.
  @return {AssetGraph} The AssetGraph instance (chaining-friendly).
  @api public
  ###
  removeRelation: (relation) ->
    if not relation or not relation.isRelation
      throw new Error("AssetGraph.removeRelation: Not a relation: " + relation)
    unless relation.id of @idIndex
      throw new Error("AssetGraph.removeRelation: " + relation + " not in graph")
    affectedRelations = [].concat(@_objInBaseAssetPaths[relation.id])
    affectedRelations.forEach ((affectedRelation) ->
      affectedRelation._unregisterBaseAssetPath()
    ), this
    relation._unregisterBaseAssetPath()
    delete @idIndex[relation.id]

    relationIndex = @_relations.indexOf(relation)
    if relationIndex is -1
      throw new Error("removeRelation: " + relation + " not in graph")
    else
      @_relations.splice relationIndex, 1
    delete @_objInBaseAssetPaths[relation.id]

    affectedRelations.forEach ((affectedRelation) ->
      affectedRelation._registerBaseAssetPath()
    ), this
    delete relation.assetGraph

    @emit "removeRelation", relation
    this

  ###
  assetGraph.findAssets([queryObj])
  =================================
  
  Query assets in the graph.
  
  Example usage:
  
  var allAssetsInGraph = ag.findAssets();
  
  var htmlAssets = ag.findAssets({type: 'Html'});
  
  var localImageAssets = ag.findAssets({
  url: /^file:.*\.(?:png|gif|jpg)$/
  });
  
  var orphanedJavaScriptAssets = ag.findAssets(function (asset) {
  return asset.type === 'JavaScript' &&
  ag.findRelations({to: asset}).length === 0;
  });
  
  var textBasedAssetsOnGoogleCom = ag.findAssets({
  isText: true,
  url: /^https?:\/\/(?:www\.)google\.com\//
  });
  
  @param {Object} queryObj (optional). Will match all assets if not provided.
  @return {Array} The found assets.
  @api public
  ###
  findAssets: (queryObj) ->
    @query.queryAssetGraph this, "asset", queryObj

  ###
  assetGraph.findRelations([queryObj[, includeUnpopulated]])
  =========================================================
  
  Query relations in the graph.
  
  Example usage:
  
  var allRelationsInGraph = ag.findRelations();
  
  var allHtmlScriptRelations = ag.findRelations({
  type: 'HtmlScript'
  });
  
  var htmlAnchorsPointingAtLocalImages = ag.findRelations({
  type: 'HtmlAnchor',
  to: {isImage: true, url: /^file:/}
  });
  
  @param {Object} queryObj (optional). Will match all relations if not provided.
  @param {Boolean} includeUnpopulated (optional). Whether to also consider
      relations that weren't followed during population. Defaults to false.
  @return {Array} The found relations.
  @api public
  ###
  findRelations: (queryObj, includeUnpopulated) ->
    relations = @query.queryAssetGraph(this, "relation", queryObj)
    if includeUnpopulated
      relations
    else
      relations.filter (relation) ->
        relation.to.isAsset

  ###
  assetGraph.recomputeBaseAssets([fromScratch])
  =============================================
  
  Recompute the base asset paths for all relations for which the base asset
  path couldn't be computed due to the graph being incomplete at the time they
  were added.
  
  Usually you shouldn't have to worry about this. This method is only exposed
  for transforms that do certain manipulations causing to graph to temporarily
  be in a state where the base asset of some relations couldn't be computed,
  e.g. if intermediate relations are been removed and attached again.
  
  Will throw an error if the base asset for any relation couldn't be found.
  
  @return {AssetGraph} The AssetGraph instance (chaining-friendly).
  @api public
  ###
  recomputeBaseAssets: (fromScratch) ->
    if fromScratch
      @_objInBaseAssetPaths = {}
      @_relationsWithNoBaseAsset = []
      @findAssets().forEach ((asset) ->
        @_objInBaseAssetPaths[asset.id] = []
      ), this
      @findRelations({}, true).forEach ((relation) ->
        @_objInBaseAssetPaths[relation.id] = []
        delete relation._baseAssetPath
      ), this
      @findRelations({}, true).forEach ((relation) ->
        relation._registerBaseAssetPath()
      ), this
    else
      [].concat(@_relationsWithNoBaseAsset).forEach ((relation) ->
        relation._unregisterBaseAssetPath()
        relation._registerBaseAssetPath()
      ), this
    this

  # Async methods for resolving asset configs and types:
  resolveAssetConfig: (assetConfig, fromUrl, cb) ->
    that = this
    if _.isArray(assetConfig)
      # Call ourselves recursively for each item, flatten the results and
      # report back
      if assetConfig.some(_.isArray)
        throw new Error("AssetGraph.resolveAssetConfig: Multidimensional array not supported.")
      return seq(assetConfig).parMap((_assetConfig) ->
        callback = this
        that.resolveAssetConfig _assetConfig, fromUrl, (err, _resolvedAssetConfigs) ->
          if err
            that.emit "error", err
            callback null, []
          else
            callback null, _resolvedAssetConfigs

      ).unflatten().seq((resolvedAssetConfigs) ->
        cb null, _.flatten(resolvedAssetConfigs)
      )["catch"](cb)
    if typeof assetConfig is "string"
      if /^[\w\+]+:/.test(assetConfig)
        # Includes protocol, assume url
        assetConfig = url: assetConfig
      else
        # File system path
        assetConfig = url: encodeURI(assetConfig)
    if assetConfig.isAsset or assetConfig.isResolved
      # Almost done, add .type property if possible (this is all we can do
      # without actually fetching the asset):
      assetConfig.type = assetConfig.type or (assetConfig.contentType and @lookupContentType(assetConfig.contentType)) or @typeByExtension[Path.extname(assetConfig.url.replace(/[\?\#].*$/, '')).toLowerCase()]
      setImmediate ->
        cb null, assetConfig
    else if assetConfig.url
      if /^[a-zA-Z\+]+:/.test(assetConfig.url)
        protocol = assetConfig.url.substr(0, assetConfig.url.indexOf(":")).toLowerCase()
        resolver = that.resolverByProtocol[protocol] or that.defaultResolver
        if resolver
          resolver assetConfig, fromUrl, (err, resolvedAssetConfig) ->
            if err
              that.emit "error", err
              cb null, []
            else
              # Keep reresolving until the .isResolved property shows up:
              that.resolveAssetConfig resolvedAssetConfig, fromUrl, cb
        else
          setImmediate ->
            that.emit "warn", new Error("AssetGraph.resolveAssetConfig: No resolver found for protocol: " + protocol)
            cb null, []
      else
        assetConfig.url = that.resolveUrl(fromUrl, assetConfig.url)
        that.resolveAssetConfig assetConfig, fromUrl, cb
    else
      setImmediate ->
        that.emit "error", new Error("AssetGraph.resolveAssetConfig: Cannot resolve asset config (no url): " + util.inspect(assetConfig))
        cb null, []

  # Resolve a url while taking the root of the AssetGraph instance into account
  resolveUrl: (fromUrl, url) ->
    that = this
    if /^\/(?:[^\/]|$)/.test(url) and /^file:/.test(fromUrl) and /^file:/.test(that.root)
      urlTools.resolveUrl that.root, url.substr(1)
    else
      urlTools.resolveUrl fromUrl, url

  # Tricky business: Might also modify assetConfig.url and assetConfig.rawSrc
  ensureAssetConfigHasType: (assetConfig, cb) ->
    return setImmediate(cb)  if assetConfig.isAsset or assetConfig.type
    
    # Looks like there's no way around loading the asset and looking at the src or metadata
    that = this
    assetConfig.rawSrcProxy (err, rawSrc, metadata) ->
      foundType = (type) ->
        that.emit "error", new Error("AssetGraph.ensureAssetConfigHasType: Couldn't determine asset type from asset config: #{util.inspect(assetConfig)}, assuming AssetGraph.Asset") unless type
        assetConfig.type = type or "Asset"
        cb()
      if err
        that.emit "warn", new Error("AssetGraph.ensureAssetConfigHasType: Couldn't load #{(assetConfig.url or util.inspect(assetConfig))}, assuming AssetGraph.Asset")
        assetConfig.type = "Asset"
        return cb()
      assetConfig.rawSrc = rawSrc
      _.extend assetConfig, metadata if metadata
      if metadata and metadata.url
        newExtension = Path.extname(assetConfig.url.replace(/[\?\#].*$/, '')).toLowerCase()
        return foundType(@typeByExtension[newExtension]) if newExtension of @typeByExtension
      if metadata and metadata.contentType
        
        # If the asset was served using HTTP, we shouldn't try to second guess by sniffing.
        foundType @lookupContentType(metadata.contentType)
      else if rawSrc.length is 0
        foundType() # Give up
      else
        # Work the magic
        fileProcess = childProcess.spawn("file", [
          "-b"
          "--mime-type"
          "-"
        ])
        fileOutput = ''
        
        # The 'file' utility might close its stdin as soon as it has figured
        # out the content type:
        fileProcess.stdin.on "error", ->

        fileProcess.stdout.on("data", (chunk) ->
          fileOutput += chunk
        ).on "end", ->
          foundType @lookupContentType(fileOutput.match(/^([^\n]*)/)[1])

        fileProcess.stdin.end rawSrc

  # Traversal:
  eachAssetPreOrder: (startAssetOrRelation, relationQueryObj, lambda) ->
    unless lambda
      lambda = relationQueryObj
      relationQueryObj = null
    @_traverse startAssetOrRelation, relationQueryObj, lambda

  eachAssetPostOrder: (startAssetOrRelation, relationQueryObj, lambda) ->
    unless lambda
      lambda = relationQueryObj
      relationQueryObj = null
    @_traverse startAssetOrRelation, relationQueryObj, null, lambda

  _traverse: (startAssetOrRelation, relationQueryObj, preOrderLambda, postOrderLambda) ->
    that = this
    relationQueryMatcher = relationQueryObj and @query.createValueMatcher(relationQueryObj)
    startAsset = undefined
    startRelation = undefined
    if startAssetOrRelation.isRelation
      startRelation = startAssetOrRelation
      startAsset = startRelation.to
    else
      # incomingRelation will be undefined when
      # (pre|post)OrderLambda(startAsset) is called
      startAsset = startAssetOrRelation
    seenAssets = {}
    assetStack = []
    (traverse = (asset, incomingRelation) ->
      unless seenAssets[asset.id]
        preOrderLambda asset, incomingRelation  if preOrderLambda
        seenAssets[asset.id] = true
        assetStack.push asset
        that.findRelations(_.extend(from: asset)).forEach (relation) ->
          if not relationQueryMatcher or relationQueryMatcher(relation)
            traverse relation.to, relation

        previousAsset = assetStack.pop()
        postOrderLambda previousAsset, incomingRelation if postOrderLambda
    ) startAsset, startRelation

  collectAssetsPreOrder: (startAssetOrRelation, relationQueryObj) ->
    assetsInOrder = []
    @eachAssetPreOrder startAssetOrRelation, relationQueryObj, (asset) ->
      assetsInOrder.push asset

    assetsInOrder

  collectAssetsPostOrder: (startAssetOrRelation, relationQueryObj) ->
    assetsInOrder = []
    @eachAssetPostOrder startAssetOrRelation, relationQueryObj, (asset) ->
      assetsInOrder.push asset

    assetsInOrder

  # Transforms:
  _runTransform: (transform, cb) ->
    that = this
    startTime = new Date()
    done = passError(cb, ->
      that.emit "afterTransform", transform, new Date().getTime() - startTime
      cb null, that
    )
    that.emit "beforeTransform", transform
    if transform.length < 2
      setImmediate ->
        try
          transform that
        catch err
          return done(err)
        done()
    else
      callbackCalled = false
      transform that, (err) ->
        if callbackCalled
          console.warn "AssetGraph._runTransform: The transform #{transform.name} called the callback more than once!"
        else
          callbackCalled = true
          done err
    that

  transforms: {}

  registerTransform: (fileNameOrFunction, name) ->
    if typeof fileNameOrFunction is "function"
      name = name or fileNameOrFunction.name
      @transforms[name] = fileNameOrFunction
    else
      # File name
      name = name or Path.basename(fileNameOrFunction, ".js")
      fileNameOrFunction = Path.resolve(process.cwd(), fileNameOrFunction) # Absolutify if not already absolute
      @transforms.__defineGetter__ name, ->
        require fileNameOrFunction

    TransformQueue::[name] = -> # ...
      @transforms.push @transforms[name].apply(this, arguments)  if not @conditions.length or @conditions[@conditions.length - 1]
      this

    # Make assetGraph.<transformName>(options) a shorthand for creating a new
    # TransformQueue:
    @[name] = ->
      transformQueue = new TransformQueue(this)
      transformQueue[name].apply transformQueue, arguments

  registerAsset: (Constructor, type) ->
    type = type or Constructor.name
    prototype = Constructor::
    prototype.type = type
    @[type] = @[type] = Constructor
    Constructor::["is" + type] = true
    if prototype.contentType
      if prototype.contentType of @typeByContentType
        console.warn "#{type}: Redefinition of Content-Type #{prototype.contentType}"
        console.trace()
      @typeByContentType[prototype.contentType] = type
    if prototype.supportedExtensions
      that = @
      prototype.supportedExtensions.forEach (supportedExtension) ->
        if supportedExtension of that.typeByExtension
          console.warn "#{type}: Redefinition of #{supportedExtension} extension"
          console.trace()
        that.typeByExtension[supportedExtension] = type

  registerRelation: (fileNameOrConstructor, type) ->
    if typeof fileNameOrConstructor is "function"
      type = type or fileNameOrConstructor.name
      fileNameOrConstructor::type = type
      @[type] = fileNameOrConstructor
    else
      # Assume file name
      getter = ->
        Constructor = require(fileNameOrConstructor)
        Constructor::type = type
        Constructor
      fileNameRegex = (
        if os.platform() is "win32" then /\\([^\\]+)\.js$/ else /\/([^\/]+)\.js$/
      )
      type = type or fileNameOrConstructor.match(fileNameRegex)[1]
      @__defineGetter__ type, getter

# Add AssetGraph helper methods that implicitly create a new TransformQueue:
["if", "queue"].forEach (methodName) ->
  AssetGraph::[methodName] = -> # ...
    transformQueue = new TransformQueue(this)
    transformQueue[methodName].apply transformQueue, arguments

AssetGraph::if_ = AssetGraph::if

module.exports = AssetGraph
