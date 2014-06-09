define(["helper/yet/another"], function () {
    // This function is called when scripts/helper/util.js is loaded.
    alert("This is helper/util speaking!");
});

// This one won't be modelled as a relation:
define('explicitName', ["helper/yet/another"], function () {
    alert("This is explicitName speaking!");
});

// Callback-less require
require(["helper/yet/another"]);

require(["./yet/another"], function () {
    alert("Got the yet-another-helper using with the module-relative syntax");
});
