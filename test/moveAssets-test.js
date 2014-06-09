var vows = require('vows'),
    expect = require('./unexpected-with-plugins'),
    urlTools = require('urltools'),
    AssetGraph = require('../lib');

vows.describe('transforms.moveAssets').addBatch({
    'After loading test case with a non-inline asset that is moved to another absolute url': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return 'http://www.example.com/blah/someotherplace.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/someotherplace.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to an absolute url without a file name': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return 'http://www.example.com/w00p/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/w00p/quux.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a relative url': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/hey/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return 'otherdir/someotherplace.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/hey/otherdir/someotherplace.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a relative url without a file name': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/yay/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return 'otherdir/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/yay/otherdir/quux.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a relative url with ../': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/hey/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '../someotherplace.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/someotherplace.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a relative url with ../ but without a file name': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets({type: 'Html', text: "foo", url: 'file:///foo/bar/hey/blah/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '../';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/hey/quux.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a root-relative url': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets({type: 'Html', text: "foo", url: 'file:///foo/bar/hello.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '/yay.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/yay.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a root-relative url without a file name': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets({type: 'Html', text: "foo", url: 'file:///foo/bar/blah/foo/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/quux.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a root-relative url without file name': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/'})
                .loadAssets({type: 'Html', text: "foo", url: 'http://www.example.com/blah/hey/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/quux.html');
        }
    },
    'After loading test case with a non-inline asset that is moved to a root-relative url without file name, file: urls': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets({type: 'Html', text: "foo", url: 'file:///foo/bar/baz/quux.html'})
                .moveAssets({type: 'Html'}, function (asset) {return '/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/quux.html');
        }
    },
    'After loading test case with an inline asset that is moved to an absolute url': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return 'http://www.example.com/foo/someotherplace.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/foo/someotherplace.html');
        }
    },
    'After loading test case with an inline asset that is moved to an absolute url without a file name': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return 'http://www.example.com/foo/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/foo/');
        }
    },
    'After loading test case with an inline asset that is moved to a relative url': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return 'here/there.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/here/there.html');
        }
    },
    'After loading test case with an inline asset that is moved to a relative url without a file name': {
        topic: function () {
            new AssetGraph({root: 'http://www.example.com/blah/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return 'here/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'http://www.example.com/blah/here/');
        }
    },
    'After loading test case with an inline asset that is moved to a root-relative url': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return '/there.html';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/there.html');
        }
    },
    'After loading test case with an inline asset that is moved to a root-relative url without a file name': {
        topic: function () {
            new AssetGraph({root: 'file:///foo/bar/'})
                .loadAssets(new AssetGraph.Html({text: "foo"}))
                .moveAssets({type: 'Html'}, function (asset) {return '/';})
                .run(this.callback);
        },
        'the url should be correct': function (assetGraph) {
            expect(assetGraph.findAssets({type: 'Html'})[0].url, 'to equal', 'file:///foo/bar/');
        }
    }
})['export'](module);
