/**
 *
 * @return KtTpl
 */
function kt_tpl(selector) {
    if (selector instanceof KtTpl)
        return selector;
    let elem = document.getElementById(selector);
    if (elem instanceof KtTpl) {
        let r = new KtTemplateParser;
        r.parseRecursive(elem);
        return elem;
    }
    throw `Selector '${selector}' is not a <kt-tpl> element`;
}



var KT_FN = {
    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "kt-classes": function(elem, val, scope) {
        "use strict";
        let $ = scope;
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            // console.log("eval", e, "ret: ", ret, "classes:", classes);
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

    "kt-attrs": function (elem, val, scope) {
        let $ = scope;
        try {
            var classes = null;
            let e = "classes = " + val;
            let ret = eval(e);
            // console.log("eval", e, "ret: ", ret, "classes:", classes);
        } catch (e) {
            throw e + " in *attrs of " + elem.outerHTML;
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