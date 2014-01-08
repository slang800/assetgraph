Xml = require './Xml'

class Atom extends Xml
  constructor: (config) ->
    super config

  contentType: 'application/atom+xml'

  supportedExtensions: ['.atom']

module.exports = Atom;
