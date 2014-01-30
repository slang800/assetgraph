var urlTools = require('urltools');

// Note: Will implicitly un-inline assets found to be identical. If you want to prevent this from happening,
// specify isInline:false or similar in the queryObj.
module.exports = function (queryObj) {
    return function mergeIdenticalAssets(assetGraph) {
        var seenAssetsByMd5 = {};
        assetGraph.findAssets(queryObj).forEach(function (asset) {
            if (asset.isExternalizable) {
                var md5Hex = asset.md5Hex;
                if (md5Hex in seenAssetsByMd5) {
                    var identicalAsset = seenAssetsByMd5[md5Hex];
                    if (!identicalAsset.url) {
                        // Un-inline the identical asset so that the two can be merged:
                        identicalAsset.url = urlTools.resolveUrl(assetGraph.root, identicalAsset.id + identicalAsset.extension);
                    }
                    assetGraph.findRelations({to: asset}).forEach(function (incomingRelation) {
                        // Avoid introducing duplicate CacheManifestEntry relations:
                        if (incomingRelation.type === 'CacheManifestEntry' && assetGraph.findRelations({from: incomingRelation.from, to: identicalAsset}).length > 0) {
                            incomingRelation.detach();
                        } else {
                            incomingRelation.to = identicalAsset;
                            incomingRelation.refreshHref();
                        }
                    });
                    assetGraph.removeAsset(asset);
                } else {
                    seenAssetsByMd5[md5Hex] = asset;
                }
            }
        });
    };
};
