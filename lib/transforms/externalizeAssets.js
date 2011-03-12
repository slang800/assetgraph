var _ = require('underscore'),
    query = require('../query');

exports.externalizeAssets = function (queryObj) {
    return function externalizeAssets(err, assetGraph, cb) {
        assetGraph.findAssets(_.extend({url: query.undefined}, queryObj)).forEach(function (inlineAsset) {
            assetGraph.setAssetUrl(inlineAsset, assetGraph.resolver.root + inlineAsset.id + '.' + inlineAsset.defaultExtension);
        });
        process.nextTick(cb);
    };
};