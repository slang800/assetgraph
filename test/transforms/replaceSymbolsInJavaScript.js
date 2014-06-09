/*global describe, it, beforeEach*/
var unexpected = require('../unexpected-with-plugins'),
    passError = require('passerror'),
    AssetGraph = require('../../lib/'),
    uglifyJs = AssetGraph.JavaScript.uglifyJs;

describe('replaceSymbolsInJavaScript', function () {
    var assetGraph;
    beforeEach(function () {
        assetGraph = new AssetGraph();
    });

    var expect = unexpected.clone().addAssertion('to come out as', function (expect, subject, value, done) {
        // subject.code, subject.defines
        expect(subject, 'to be an object');
        var assetConfig = {
            url: 'file://' + __dirname + '/bogus.js'
        };
        if (subject.parseTree instanceof uglifyJs.AST_Node) {
            assetConfig.parseTree = subject.parseTree;
        } else if (typeof subject.text === 'string') {
            assetConfig.text = subject.text;
        } else if (Buffer.isBuffer(subject.rawSrc)) {
            assetConfig.rawSrc = subject.rawSrc;
        }
        assetGraph
            .loadAssets(new AssetGraph.JavaScript(assetConfig))
            .replaceSymbolsInJavaScript({type: 'JavaScript'}, subject.defines || {})
            .queue(function (assetGraph) {
                expect(assetGraph.findAssets({fileName: 'bogus.js'})[0], 'to have the same AST as', value);
            })
            .run(done);
    });

    it('should replace a primitive value', function (done) {
        expect({
            text: 'var bar = FOO;',
            defines: {
                FOO: '"foo"'
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = 'foo';
            /* jshint ignore:end */
        }, done);
    });

    it('should not replace the LHS of an assignment', function (done) {
        expect({
            text: 'var FOO = "bar";',
            defines: {
                FOO: new uglifyJs.AST_String({value: 'foo'})
            }
        }, 'to come out as', 'var FOO = "bar";', done);
    });

    it('should replace complex value', function (done) {
        expect({
            text: 'var bar = FOO;',
            defines: {
                FOO: {quux: {baz: 123}}
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = {quux: {baz: 123}};
            /* jshint ignore:end */
        }, done);
    });

    it('should replace nested value with dot notation', function (done) {
        expect({
            text: 'var bar = FOO.quux;',
            defines: {
                FOO: {quux: 'baz'}
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = 'baz';
            /* jshint ignore:end */
        }, done);
    });

    it('should replace nested value with bracket notation', function (done) {
        expect({
            text: 'var bar = FOO["quux"];',
            defines: {
                FOO: {quux: 'baz'}
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = 'baz';
            /* jshint ignore:end */
        }, done);
    });

    it('should replace nested value with mixed notation', function (done) {
        expect({
            text: 'var bar = FOO["quux"].baz;',
            defines: {
                FOO: { quux: { baz: 'foo' } }
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = 'foo';
            /* jshint ignore:end */
        }, done);
    });

    it('should not replace nested value if no value is found', function (done) {
        var warnings = [];
        assetGraph.on('warn', function (err) {
            warnings.push(err);
        });
        expect({
            text: 'var bar = FOO["quux"];',
            defines: {
                FOO: { bar: 'baz' }
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = FOO['quux'];
            /* jshint ignore:end */
        }, passError(done, function () {
            expect(warnings, 'to have length', 1);
            expect(warnings[0].message, 'to equal', 'Trying to replace with non-existent key "quux" on FOO');
            done();
        }));
    });

    it.skip('should not proceed if contents of brackets is not a constant', function (done) {
        expect({
            text: 'var bar = FOO[function () { return "NO"; }];',
            defines: {
                FOO: { bar: 'baz' }
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            var bar = { bar: 'baz' }[function () { return "NO"; }];
            /* jshint ignore:end */
        }, done);
    });

    // Wishful thinking:
    it.skip('should support dot notation in the LHS', function (done) {
        expect({
            text: 'console.log(123);',
            defines: {
                'console.log': 'foo.bar'
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            foo.bar(123);
            /* jshint ignore:end */
        }, done);
    });

    it.skip('should support bracket notation in the LHS', function (done) {
        expect({
            text: 'alert(123 + hereIs["the thing"]);',
            defines: {
                'hereIs["the thing"]': 987
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            alert(123 + 987);
            /* jshint ignore:end */
        }, done);
    });

    it.skip('should support a complex expression in the LHS', function (done) {
        expect({
            text: '123 + foo(1 + 2);',
            defines: {
                'foo(1 + 2)': '456'
            }
        }, 'to come out as', function () {
            /* jshint ignore:start */
            123 + 456;
            /* jshint ignore:end */
        }, done);
    });
});
