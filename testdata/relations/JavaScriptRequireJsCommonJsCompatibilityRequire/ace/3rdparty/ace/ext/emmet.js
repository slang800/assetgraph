/* ***** BEGIN LICENSE BLOCK *****
 * Distributed under the BSD license:
 *
 * Copyright (c) 2010, Ajax.org B.V.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of Ajax.org B.V. nor the
 *       names of its contributors may be used to endorse or promote products
 *       derived from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 * ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL AJAX.ORG B.V. BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 * SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 *
 * ***** END LICENSE BLOCK ***** */

define(function(require, exports, module) {
"use strict";
var HashHandler = require("ace/keyboard/hash_handler").HashHandler;
var Editor = require("ace/editor").Editor;
var emmet;

Editor.prototype.indexToPosition = function(index) {
    return this.session.doc.indexToPosition(index);
};

Editor.prototype.positionToIndex = function(pos) {
    return this.session.doc.positionToIndex(pos);
};

/**
 * Implementation of {@link IEmmetEditor} interface for Ace
 */
function AceEmmetEditor() {}

AceEmmetEditor.prototype = {
    setupContext: function(editor) {
        this.ace = editor;
        this.indentation = editor.session.getTabString();
        emmet.require("resources").setVariable("indentation", this.indentation);
        this.$syntax = null;
        this.$syntax = this.getSyntax();
    },
    /**
     * Returns character indexes of selected text: object with <code>start</code>
     * and <code>end</code> properties. If there's no selection, should return
     * object with <code>start</code> and <code>end</code> properties referring
     * to current caret position
     * @return {Object}
     * @example
     * var selection = editor.getSelectionRange();
     * alert(selection.start + ', ' + selection.end);
     */
    getSelectionRange: function() {
        // TODO should start be caret position instead?
        var range = this.ace.getSelectionRange();
        return {
            start: this.ace.positionToIndex(range.start),
            end: this.ace.positionToIndex(range.end)
        };
    },

    /**
     * Creates selection from <code>start</code> to <code>end</code> character
     * indexes. If <code>end</code> is ommited, this method should place caret
     * and <code>start</code> index
     * @param {Number} start
     * @param {Number} [end]
     * @example
     * editor.createSelection(10, 40);
     *
     * //move caret to 15th character
     * editor.createSelection(15);
     */
    createSelection: function(start, end) {
        this.ace.selection.setRange({
            start: this.ace.indexToPosition(start),
            end: this.ace.indexToPosition(end)
        });
    },

    /**
     * Returns current line's start and end indexes as object with <code>start</code>
     * and <code>end</code> properties
     * @return {Object}
     * @example
     * var range = editor.getCurrentLineRange();
     * alert(range.start + ', ' + range.end);
     */
    getCurrentLineRange: function() {
        var row = this.ace.getCursorPosition().row;
        var lineLength = this.ace.session.getLine(row).length;
        var index = this.ace.positionToIndex({row: row, column: 0});
        return {
            start: index,
            end: index + lineLength
        };
    },

    /**
     * Returns current caret position
     * @return {Number|null}
     */
    getCaretPos: function(){
        var pos = this.ace.getCursorPosition();
        return this.ace.positionToIndex(pos);
    },

    /**
     * Set new caret position
     * @param {Number} index Caret position
     */
    setCaretPos: function(index){
        var pos = this.ace.indexToPosition(index);
        this.ace.clearSelection();
        this.ace.selection.moveCursorToPosition(pos);
    },

    /**
     * Returns content of current line
     * @return {String}
     */
    getCurrentLine: function() {
        var row = this.ace.getCursorPosition().row;
        return this.ace.session.getLine(row);
    },

    /**
     * Replace editor's content or it's part (from <code>start</code> to
     * <code>end</code> index). If <code>value</code> contains
     * <code>caret_placeholder</code>, the editor will put caret into
     * this position. If you skip <code>start</code> and <code>end</code>
     * arguments, the whole target's content will be replaced with
     * <code>value</code>.
     *
     * If you pass <code>start</code> argument only,
     * the <code>value</code> will be placed at <code>start</code> string
     * index of current content.
     *
     * If you pass <code>start</code> and <code>end</code> arguments,
     * the corresponding substring of current target's content will be
     * replaced with <code>value</code>.
     * @param {String} value Content you want to paste
     * @param {Number} [start] Start index of editor's content
     * @param {Number} [end] End index of editor's content
     * @param {Boolean} [noIndent] Do not auto indent <code>value</code>
     */
    replaceContent: function(value, start, end, noIndent) {
        if (end == null)
            end = start == null ? content.length : start;
        if (start == null)
            start = 0;
        var utils = emmet.require("utils");

        // indent new value
        if (!noIndent) {
            value = utils.padString(value, utils.getLinePaddingFromPosition(this.getContent(), start));
        }

        // find new caret position
        var tabstopData = emmet.require("tabStops").extract(value, {
            escape: function(ch) {
                return ch;
            }
        });

        value = tabstopData.text;
        var firstTabStop = tabstopData.tabstops[0];

        if (firstTabStop) {
            firstTabStop.start += start;
            firstTabStop.end += start;
        } else {
            firstTabStop = {
                start: value.length + start,
                end: value.length + start
            };
        }

        var range = this.ace.getSelectionRange();
        range.start = this.ace.indexToPosition(start);
        range.end = this.ace.indexToPosition(end);

        this.ace.session.replace(range, value);

        range.start = this.ace.indexToPosition(firstTabStop.start);
        range.end = this.ace.indexToPosition(firstTabStop.end);
        this.ace.selection.setRange(range);
    },

    /**
     * Returns editor's content
     * @return {String}
     */
    getContent: function(){
        return this.ace.getValue();
    },

    /**
     * Returns current editor's syntax mode
     * @return {String}
     */
    getSyntax: function() {
        if (this.$syntax)
            return this.$syntax;
        var syntax = this.ace.session.$modeId.split("/").pop();
        if (syntax == "html" || syntax == "php") {
            var cursor = this.ace.getCursorPosition();
            var state = this.ace.session.getState(cursor.row);
            if (typeof state != "string")
                state = state[0];
            if (state) {
                state = state.split("-");
                if (state.length > 1)
                    syntax = state[0];
                else if (syntax == "php")
                    syntax = "html"
            }
        }
        return syntax;
    },

    /**
     * Returns current output profile name (@see emmet#setupProfile)
     * @return {String}
     */
    getProfileName: function() {
        switch(this.getSyntax()) {
          case "css": return "css";
          case "xml":
          case "xsl":
            return "xml";
          case "html":
            var profile = emmet.require("resources").getVariable("profile");
            // no forced profile, guess from content html or xhtml?
            if (!profile)
                profile = this.ace.session.getLines(0,2).join("").search(/<!DOCTYPE[^>]+XHTML/i) != -1 ? "xhtml": "html";
            return profile;
        }
        return "xhtml";
    },

    /**
     * Ask user to enter something
     * @param {String} title Dialog title
     * @return {String} Entered data
     * @since 0.65
     */
    prompt: function(title) {
        return prompt(title);
    },

    /**
     * Returns current selection
     * @return {String}
     * @since 0.65
     */
    getSelection: function() {
        return this.ace.session.getTextRange();
    },

    /**
     * Returns current editor's file path
     * @return {String}
     * @since 0.65
     */
    getFilePath: function() {
        return "";
    }
};


var keymap = {
    expand_abbreviation: {"mac": "ctrl+alt+e", "win": "alt+e"},
    match_pair_outward: {"mac": "ctrl+d", "win": "ctrl+,"},
    match_pair_inward: {"mac": "ctrl+j", "win": "ctrl+shift+0"},
    matching_pair: {"mac": "ctrl+alt+j", "win": "alt+j"},
    next_edit_point: "alt+right",
    prev_edit_point: "alt+left",
    toggle_comment: {"mac": "command+/", "win": "ctrl+/"},
    split_join_tag: {"mac": "shift+command+'", "win": "shift+ctrl+`"},
    remove_tag: {"mac": "command+'", "win": "shift+ctrl+;"},
    evaluate_math_expression: {"mac": "shift+command+y", "win": "shift+ctrl+y"},
    increment_number_by_1: "ctrl+up",
    decrement_number_by_1: "ctrl+down",
    increment_number_by_01: "alt+up",
    decrement_number_by_01: "alt+down",
    increment_number_by_10: {"mac": "alt+command+up", "win": "shift+alt+up"},
    decrement_number_by_10: {"mac": "alt+command+down", "win": "shift+alt+down"},
    select_next_item: {"mac": "shift+command+.", "win": "shift+ctrl+."},
    select_previous_item: {"mac": "shift+command+,", "win": "shift+ctrl+,"},
    reflect_css_value: {"mac": "shift+command+r", "win": "shift+ctrl+r"},

    encode_decode_data_url: {"mac": "shift+ctrl+d", "win": "ctrl+'"},
    // update_image_size: {"mac": "shift+ctrl+i", "win": "ctrl+u"},
    // expand_as_you_type: "ctrl+alt+enter",
    // wrap_as_you_type: {"mac": "shift+ctrl+g", "win": "shift+ctrl+g"},
    expand_abbreviation_with_tab: "Tab"
};

var editorProxy = new AceEmmetEditor();
exports.commands = new HashHandler();
function runEmmetCommand(editor) {
    editorProxy.setupContext(editor);
    if (editorProxy.getSyntax() == "php")
        return false;
    var actions = emmet.require("actions")

    try {
        var result = actions.run(this.name, editorProxy);
    } catch(e) {
        editor._signal("changeStatus", typeof e == "string" ? e : e.message);
        console.log(e);
    }
    return result;
}

for (var command in keymap) {
    exports.commands.addCommand({
        name: command,
        bindKey: keymap[command],
        exec: runEmmetCommand
    });
}

var onChangeMode = function(e, target) {
    var editor = target;
    if (!editor)
        return;
    var modeId = editor.session.$modeId;
    var enabled = modeId && /css|less|sass|html|php/.test(modeId);
    if (e.enableEmmet === false)
        enabled = false;
    if (enabled)
        editor.keyBinding.addKeyboardHandler(exports.commands);
    else
        editor.keyBinding.removeKeyboardHandler(exports.commands);
};


exports.AceEmmetEditor = AceEmmetEditor
require("ace/config").defineOptions(Editor.prototype, "editor", {
    enableEmmet: {
        set: function(val) {
            this[val ? "on" : "removeListener"]("changeMode", onChangeMode);
            onChangeMode({enableEmmet: !!val}, this);
        },
        value: true
    }
});


exports.setCore = function(e) {emmet = e;};
});

