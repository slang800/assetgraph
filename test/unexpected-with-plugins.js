var URL = require('url'),
    urlTools = require('urltools'),
    AssetGraph = require('../lib/'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs,
    expect = module.exports = require('unexpected')
        .clone()
        .installPlugin(require('unexpected-jsdom'));

expect.addAssertion('to contain [no] (asset|assets)', function (expect, subject, queryObj, number) {
    this.errorMode = 'nested';
    if (typeof queryObj === 'string') {
        queryObj = {type: queryObj};
    } else if (typeof queryObj === 'number') {
        number = queryObj;
        queryObj = {};
    }
    if (this.flags.no) {
        number = 0;
    } else if (typeof number === 'undefined') {
        number = 1;
    }
    expect(subject.findAssets(queryObj).length, 'to equal', number);
});

expect.addAssertion('to contain (url|urls)', function (expect, subject, urls) {
    if (!Array.isArray(urls)) {
        urls = [urls];
    }
    urls = urls.map(function (url) {
        return URL.resolve(this.obj.root, url);
    }, this);
    this.errorMode = 'nested';
    urls.forEach(function (url) {
        expect(subject.findAssets({url: url}).length, 'to equal', 1);
    });
});

expect.addAssertion('to contain [no] (relation|relations) [including unresolved]', function (expect, subject, queryObj, number) {
    if (typeof queryObj === 'string') {
        queryObj = {type: queryObj};
    } else if (typeof queryObj === 'number') {
        number = queryObj;
        queryObj = {};
    }
    if (this.flags.no) {
        number = 0;
    } else if (typeof number === 'undefined') {
        number = 1;
    }
    this.errorMode = 'nested';
    expect(subject.findRelations(queryObj, this.flags['including unresolved']).length, 'to equal', number);
});

function toAst(stringOrAssetOrFunctionOrAst) {
    if (typeof stringOrAssetOrFunctionOrAst === 'string') {
        return uglifyJs.parse(stringOrAssetOrFunctionOrAst);
    } else if (stringOrAssetOrFunctionOrAst.isAsset) {
        return stringOrAssetOrFunctionOrAst.parseTree;
    } else if (typeof stringOrAssetOrFunctionOrAst === 'function') {
        return uglifyJs.parse(stringOrAssetOrFunctionOrAst.toString().replace(/^function[^\(]*?\(\)\s*\{|\}$/g, ''));
    } else {
        return stringOrAssetOrFunctionOrAst;
    }
}

expect.addAssertion('to have the same AST as', function (expect, subject, value) {
    expect(toAst(subject).print_to_string(), 'to equal', toAst(value).print_to_string());
});

expect.addType({
    identify: function (obj) {
        return obj && obj.isAsset;
    },
    equal: function (a, b) {
        return (
            a.type === b.type &&
            a.urlOrDescription === b.urlOrDescription &&
            (a.isText ? a.text : a.rawSrc) === (b.isText ? b.text : b.rawSrc)
            // && same outgoing relations
        );
    },
    inspect: function (asset) {
        return asset.urlOrDescription;
    },
    toJSON: function (asset) {
        return {
            $Asset: {
                type: asset.type,
                urlOrDescription: asset.urlOrDescription,
                outgoingRelations: asset.outgoingRelations
            }
        };
    }
});

expect.addType({
    identify: function (obj) {
        return obj && obj.isAssetGraph;
    },
    inspect: function (assetGraph) {
        return ['AssetGraph'].concat(assetGraph.findAssets({isInline: false}).map(function (asset) {
            return '  ' + (asset.isLoaded ? ' ' : '!') + ' ' + urlTools.buildRelativeUrl(assetGraph.root, asset.url);
        }, this)).join('\n  ');
    },
    toJSON: function (assetGraph) {
        return {
            $AssetGraph: {
                assets: assetGraph.findAssets({isInline: false}),
            }
        };
    }
});

expect.addType({
    identify: function (obj) {
        return obj && obj.isRelation;
    },
    equal: function (a, b) {
        return a === b;
    },
    inspect: function (relation) {
        return relation.toString();
    },
    toJSON: function (relation) {
        return {
            $Relation: {
                id: relation.id,
                type: relation.type,
                from: relation.from.urlOrDescription,
                to: relation.to.urlOrDescription
            }
        };
    }
});

expect.addType({
    identify: function (obj) {
        return obj instanceof uglifyJs.AST_Node;
    },
    equal: function (a, b) {
        return a.equivalent_to(b);
    },
    inspect: function (astNode) {
        return '[AST: ' + astNode.print_to_string() + ']';
    },
    toJSON: function (astNode) {
        return {
            $Ast: astNode.print_to_string()
        };
    }
});
