_ = require("underscore")
module.exports = (queryObj) ->
  compileCoffeeScriptToJavaScript = (assetGraph) ->
    coffeeScript = undefined
    coffeeScriptAssets = assetGraph.findAssets(_.extend(
      type: "CoffeeScript"
    , queryObj))
    if coffeeScriptAssets.length > 0
      try
        coffeeScript = require('coffee-script')
      catch e
        assetGraph.emit 'warn', new Error("compileCoffeeScriptToJavaScript: Found #{coffeeScriptAssets.length} coffeescript asset(s), but no coffeescript compiler is available. Please install coffeescript in your project so compileCoffeeScript can require it.")
        return

    coffeeScriptAssets.forEach (coffeeScriptAsset) ->
      javaScriptAsset = new assetGraph.JavaScript(
        text: coffeeScript.compile(coffeeScriptAsset.text)
      )
      if coffeeScriptAsset.url
        javaScriptAsset.url = coffeeScriptAsset.url.replace(
          /\.coffee$|$/,
          javaScriptAsset.defaultExtension
        )
      coffeeScriptAsset.replaceWith javaScriptAsset

      # FIXME: This should be a side effect of setting HtmlScript.href or
      # something:
      javaScriptAsset.incomingRelations.forEach (incomingRelation) ->
        if incomingRelation.type is 'HtmlScript'
          typeAttributeValue = incomingRelation.node.getAttribute('type')
          if typeAttributeValue is 'text/coffeescript'
            incomingRelation.node.removeAttribute 'type'
            incomingRelation.from.markDirty()
        return
      return
    return
