var expect = require('./unexpected-with-plugins'),
    urlTools = require('urltools'),
    AssetGraph = require('../lib');

describe('StaticUrlMap', function () {
    it('should handle a combo test case', function (done) {
        new AssetGraph({root: __dirname + '/StaticUrlMap/combo/'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relations', 'JavaScriptGetStaticUrl', 2);
                expect(assetGraph, 'to contain assets', 'StaticUrlMap', 2);
                expect(assetGraph, 'to contain relations', 'StaticUrlMapEntry', 4);
                assetGraph.findAssets({type: 'JavaScript', text: 'alert("ac.js");\n'})[0].url = "http://google.com/foo.js";
                assetGraph.findAssets({type: 'Json', parseTree: {iAmQuux: true}})[0].url = urlTools.resolveUrl(assetGraph.root, 'anotherquux.json');
                expect(assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text, 'to match', /google\.com/);
                expect(assetGraph.findAssets({type: 'JavaScript', isInline: true})[0].text, 'to match', /anotherquux.json/);
            })
            .run(done);
    });

    it('should handle a complex test case with a multi-level GETSTATICURL construct', function (done) {
        this.timeout(20000);
        new AssetGraph({root: __dirname + '/StaticUrlMap/multiLevel'})
            .loadAssets('index.html')
            .populate()
            .queue(function (assetGraph) {
                expect(assetGraph, 'to contain relation', 'JavaScriptGetStaticUrl');
                expect(assetGraph, 'to contain asset', 'StaticUrlMap');
                expect(assetGraph, 'to contain relations including unresolved', 'StaticUrlMapEntry', 502);

                var javaScript = assetGraph.findAssets({type: 'JavaScript'})[0];
                javaScript.text = javaScript.text;
                expect(assetGraph, 'to contain relations including unresolved', 'StaticUrlMapEntry', 502);
            })
            .run(done);
    });
});
