var vows = require('vows'),
    assert = require('assert'),
    urlTools = require('urltools'),
    AssetGraph = require('../lib'),
    query = AssetGraph.query;

vows.describe('Edge side include test').addBatch({
    'After loading test case': {
        topic: function () {
            new AssetGraph({root: __dirname + '/HtmlEdgeSideInclude/'})
                .loadAssets('index.html')
                .populate({
                    followRelations: {to: {url: /\.html$/}}
                })
                .run(this.callback);
        },
        'the graph should contain two Html assets': function (assetGraph) {
            assert.equal(assetGraph.findAssets({type: 'Html'}).length, 2);
        },
        'the graph should contain one populated HtmlEdgeSideInclude relation': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlEdgeSideInclude'}).length, 1);
        },
        'the graph should contain two HtmlEdgeSideInclude relations in total': function (assetGraph) {
            assert.equal(assetGraph.findRelations({type: 'HtmlEdgeSideInclude'}, true).length, 2);
        },
        'then move the index.html one subdir down': {
            topic: function (assetGraph) {
                assetGraph.findAssets({url: /\/index\.html/})[0].url = urlTools.resolveUrl(assetGraph.root, 'foo/index.html');
                return assetGraph;
            },
            'the url of the unpopulated HtmlEdgeSideInclude relation should be updated': function (assetGraph) {
                assert.equal(assetGraph.findRelations({to: {url: /\.php$/}, type: 'HtmlEdgeSideInclude'}, true)[0].href,
                             '../dynamicStuff/getTitleForReferringPage.php');
            }
        }
    }
})['export'](module);
