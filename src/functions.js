var KT_FN = {
    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "[class]": function(elem, val, scope) {
        "use strict";
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in [data] of " + elem.outerHTML;
        }
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] === true) {
                elem.classList.add(className);
            } else {
                elem.classList.remove(className);
            }
        }
    },

    "[attr]": function (elem, val, scope) {
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in [data] of " + elem.outerHTML;
        }
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] !== null) {
                elem.setAttribute(className, classes[className]);
            } else {
                elem.setAttribute(className, "");
            }
        }
    }
};
var KT_DATA = [];