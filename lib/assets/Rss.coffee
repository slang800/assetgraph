util = require 'util'
Xml = require './Xml'
AssetGraph = require '../'

class Rss extends Xml
  contentType: 'application/rss+xml'
  supportedExtensions: ['.rdf', '.rss']

  findOutgoingRelationsInParseTree: ->
    outgoingRelations = []
    queue = [@parseTree]
    link = null
    descriptions = []
    while queue.length
      node = queue.shift()
      if node.childNodes
        i = node.childNodes.length - 1
        while i >= 0
          queue.unshift node.childNodes[i]
          i -= 1
      if node.nodeType is 1 and
         node.nodeName is 'description' and
         node.parentNode.nodeType is 1 and
         node.parentNode.nodeName is 'item'

        outgoingRelations.push new AssetGraph.HtmlInlineFragment(
          from: this
          to: new AssetGraph.Html(
            isFragment: true
            isInline: true
            text: node.textContent or ''
          )
          node: node
        )
        descriptions.push node
      else if node.nodeType is 1 and
              node.nodeName is 'link' and
              node.parentNode.nodeType is 1 and
              node.parentNode.nodeName is 'channel'
        link = node
    outgoingRelations

module.exports = Rss
