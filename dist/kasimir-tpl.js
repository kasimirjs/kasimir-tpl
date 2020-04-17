/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @author Matthias Leuffen <m@tth.es>
 */

class KtHelper {


    /**
     *
     * @param {string} stmt
     * @param {context} c
     * @param {HTMLElement} e
     * @return {any}
     */
    keval(stmt, c, e) {
        try {
            let $ = c;
            return eval(stmt)
        } catch (ex) {
            console.warn("cannot eval() stmt: '" + stmt + "' on element ", e.outerHTML, "(context:", c, ")");
            throw "eval('" + stmt + "') failed: " + ex;
        }
    }

    /**
     * Returns a string to be eval()'ed registering
     * all the variables in scope to method context
     *
     * @param {object} $scope
     * @param {string} selector
     * @return {string}
     *
     */
    scopeEval($scope, selector) {
        let r = "let $ = $scope;";
        for (let __name in $scope) {
            r += `var ${__name} = $scope['${__name}'];`
        }
        let __val = null;
        r += `__val = ${selector};`;
        eval(r);
        return __val;
    }


}

var _KT_ELEMENT_ID = 0;

class KtRenderable extends HTMLTemplateElement {



    constructor() {
        super();
        /**
         *
         * @type {KtHelper}
         * @private
         */
        this._hlpr = new KtHelper();

        /**
         * Array with all observed elements of this template
         *
         * null indicates, the template was not yet rendered
         *
         * @type {HTMLElement[]}
         * @private
         */
        this._els = null;
        this._attrs = {"debug": false};
        /**
         * The internal element id to identify which elements
         * to render.
         *
         * @type {number}
         * @private
         */
        this._ktId = ++_KT_ELEMENT_ID;
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    _log(v1, v2, v3) {
        let a = arguments;

        if (this._attrs.debug !== false)
            console.log.apply(this, a);
    }


    /**
     *
     * @param {HTMLElement} node
     * @param {object} context
     */
    renderRecursive(node, context, ownerNodes) {
        if (typeof node.render === "function") {
            node.render(context);
            return;
        }
        if (node.hasOwnProperty("ktOwner") && ownerNodes !== true)
            return;

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, context);
        }

    }

}






class KtTemplateParser {


    /**
     *
     * @param text
     * @param {DocumentFragment} fragment
     * @return {null}
     * @private
     */
    _parseTextNode (text, fragment) {
        let split = text.split(/(\{\{|\}\})/);
        while(split.length > 0) {
            fragment.appendChild(new Text(split.shift()));
            if (split.length === 0)
                break;

            split.shift();
            let val = new KaVal();
            val.setAttribute("stmt", split.shift().trim());
            split.shift();
            fragment.appendChild(val);
        }
    }

    /**
     *
     * @param {HTMLElement} node
     */
    parseRecursive(node) {
        //console.log("[ka-tpl] parseRecursive(", node, ")");
        if (node instanceof DocumentFragment) {
            for (let n of node.children)
                this.parseRecursive(n);
            return;
        }


        if (typeof node.getAttribute !== "function")
            return;

        if (node.ktParsed === true)
            return;

        node.ktParsed = true;

        for (let textNode of node.childNodes) {
            if (typeof textNode.data === "undefined")
                continue;
            let fragment = new DocumentFragment();
            this._parseTextNode(textNode.data, fragment);
            textNode.replaceWith(fragment);

        }

        if (node.hasAttribute("*for")) {
            let newNode = document.createElement("template", {is: "kt-for"});
            let attr = node.getAttribute("*for");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("forselect", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

        if (node.hasAttribute("*if")) {
            let newNode = document.createElement("template", {is: "kt-if"});
            let attr = node.getAttribute("*if");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("stmt", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

        let cssClasses = [];
        let attrs = [];

        let regex = new RegExp("^\\[(.+)\\]$");
        for(let attrName of node.getAttributeNames()) {

            let result = regex.exec(attrName);
            if (result === null)
                continue;

            let split = result[1].split(".");
            if (split.length === 1) {
                attrs.push(`'${split[0]}': ` + node.getAttribute(attrName));
            } else {
                switch (split[0]) {
                    case "classlist":
                        cssClasses.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;
                    default:
                        console.warn("Invalid attribute '" + attrName + "'")
                }
            }
        }

        if (attrs.length > 0 || cssClasses.length > 0) {
            let newNode = document.createElement("template", {is: "kt-maintain"});
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true)
            newNode.content.appendChild(cloneNode);
            if (attrs.length > 0)
                cloneNode.setAttribute("kt-attrs", "{" + attrs.join(",") +  "}");
            if (cssClasses.length > 0)
                cloneNode.setAttribute("kt-classes", "{" + cssClasses.join(",") + "}");
            node.replaceWith(newNode);
            node = cloneNode;
        }

        for (let curNode of node.children)
            this.parseRecursive(curNode);



    }

}
/**
 *
 * @return KaTpl
 */
function ka_tpl(selector) {
    if (selector instanceof KaTpl)
        return selector;
    let elem = document.getElementById(selector);
    if (elem instanceof KaTpl) {
        return elem;
    }
    throw `Selector '${selector}' is not a <template is="ka-tpl"> element`;
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
        for (let __name in scope) {
            eval(`let ${__name} = scope['${__name}'];`);
        }
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
        for (let __name in scope) {
            eval(`let ${__name} = scope['${__name}'];`);
        }
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
var KASELF = null;

class KaTpl extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null
        };

        // Switched to to during _init() to allow <script> to set scope without rendering.
        this._isInitializing = false;
        this._isRendering = false;
        this._scope = {};
    }

    static get observedAttributes() {
        return ["stmt", "debug"];
    }


    disconnectedCallback() {
        for (let el of this._els)
            this.parentElement.removeChild(el);
    }

    connectedCallback() {
        if (this.hasAttribute("auto")) {
            document.addEventListener("DOMContentLoaded", () => {
                this._init();
                this.render(this._scope)
            });
        }
    }

    /**
     * Set the scope and render the template
     *
     * ```
     * ka_tpl("tpl01").$scope = {name: "bob"};
     * ```
     *
     * @param val
     */
    set $scope(val) {
        this._scope = val;

        // Render only if dom available (allow <script> inside template to set scope before first rendering
        if ( ! this._isInitializing)
            this.render(this._scope);
    }

    get $scope() {
        let handler = {
            set: (target, property, value, receiver) => {
                console.log ("set:", target, property, value);
                target[property] = value;
                // Don't update proxy during rendering (recursion)
                if ( ! this._isRendering)
                    this.render(this.$scope);
                return true;
            },
            get: (target, key) => {
                if (typeof target[key] === "object")
                    return new Proxy(target[key], handler);
                return target[key];
            }

        }


        return new Proxy(this._scope, handler);
    }



    _init() {
        if (this._els !== null)
            return;
        this._isInitializing = true;
        if (this.nextElementSibling !== null) {
            // Remove loader element
            if (this.nextElementSibling.hasAttribute("ka-loader"))
                this.parentElement.removeChild(this.nextElementSibling);
        }
        let sibling = this.nextSibling;
        (new KtTemplateParser).parseRecursive(this.content);

        let cn = this.content.cloneNode(true);
        this._els = [];
        this._log(cn.children);
        for (let cel of cn.children) {
            cel.ktOwner = this._ktId;
            this._els.push(cel);
        }
        KASELF = this;
        this.parentElement.insertBefore(cn, sibling);

        this._isInitializing = false;
    }

    render($scope) {
        this._log("render($scope= ", $scope, ")");
        this._init();
        this._isRendering = true;
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope, true);
        }
        this._isRendering = false;
    }
}

customElements.define("ka-tpl", KaTpl, {extends: "template"});
class KaVal extends HTMLElement {


    constructor() {
        super();
        /**
         *
         * @type {KtHelper}
         * @private
         */
        this._ktHlpr = new KtHelper();
        this._attrs = {
            "debug": false,
            "stmt": null,
            "afterrender": null
        }
    }

    static get observedAttributes() {
        return ["stmt", "afterrender", "debug"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    connectedCallback() {
        if (this.hasAttribute("auto"))
            this.render({});
    }
    _log() {
        if (this._attrs.debug !== false) {

            console.log.apply(this, arguments);
        }

    }
    render($scope) {
        this._log(`render(`, $scope, `) on '${this.outerHTML}'`);
        try {

            let v = this._ktHlpr.scopeEval($scope, this._attrs.stmt);
            if (this.hasAttribute("unindent")) {
                let i = v.match(/\n(\s*)/m)[1];
                v = v.replace(new RegExp(`\n${i}`, "g"), "\n");
                v = v.trim();
            }

            if (this.hasAttribute("html")) {
                this.innerHTML = v;
            } else {
                this.innerText = v;
            }
            if (this._attrs.afterrender !== null)
                eval(this._attrs.afterrender)
        } catch (e) {
            this.innerText = e;
        }
    }
}

customElements.define("ka-val", KaVal);



class KtFor extends KtRenderable {


    constructor() {
        super();
        this.elements = [];
        this.origSibling = false;
        this.params = {
            "forselect": null,
            "foridx": "idx",
            "foreval": null
        }
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "foreval"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {
        let select = context[this.params.forselect];
        let $ = context;
        if (typeof select !== "object") {
            console.warn(`Invalid forSelect="${this.params.forselect}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }

        if (this.origSibling === false)
            this.origSibling = this.nextSibling;

        for (let idx = this.elements.length; idx < select.length; idx++ ) {
            let newNode = this.content.cloneNode(true);
            let nodes = [];
            for (let curNode of newNode.children) {
                curNode.ktOwner = "for";
                nodes.push(curNode);
            }
            for (let i = 0; i < nodes.length; i++)
                this.parentElement.insertBefore(nodes[i], this.origSibling);
            this.elements.push({
                node: nodes
            });

        }

        for (let idx = 0; idx < select.length; idx++) {
            context[this.params.foridx] = idx;
            context["self"] = select[idx];
            if (this.params.foreval !== null)
                this._hlpr.keval(this.params.foreval, context, this);
            for (let curNode of this.elements[idx].node) {
                this.renderRecursive(curNode, context, true);
            }
        }


        for (let idx = this.elements.length; select.length < this.elements.length; idx++) {
            let elem = this.elements.pop();
            for (let curNode of elem.node)
                this.parentElement.removeChild(curNode);
        }
    }
}

customElements.define("kt-for", KtFor, {extends: "template"});



class KtIf extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this._attrs = {
            "stmt": null
        }
    }

    static get observedAttributes() {
        return ["stmt"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    render(context) {
        let stmt = this.params.stmt;

        let isTrue = this._hlpr.scopeEval($scope, this._attr.stmt);

        if (isTrue) {

            if (this.elements !== null) {
                for (let curElement of this.elements)
                    this.renderRecursive(curElement, context, true);
                return;
            }
            let newNode = this.content.cloneNode(true);
            this.elements = [];
            for (let curNode of newNode.childNodes) {
                curNode.ktOwner = "if";
                this.elements.push(curNode);
            }
            for (let i = this.elements.length-1; i>=0; i--) {
                this.parentElement.insertBefore(this.elements[i], this.nextSibling);
            }
            for (let curNode of this.elements)
                this.renderRecursive(curNode, context, true);
        } else {
            if (this.elements === null)
                return;
            for (let node of this.elements)
                this.parentElement.removeChild(node);
            this.elements = null;
        }

    }
}

customElements.define("kt-if", KtIf, {extends: "template"});


class KtInclude extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this.params = {
            "src": null
        }
    }

    static get observedAttributes() {
        return ["src"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }


    loadRemote () {

    }


    _appendChildFromContent() {
        if (this.elements !== null)
            return;
        let newNode = this.content.cloneNode(true);
        this.elements = [];
        for (let curNode of newNode.childNodes) {
            curNode.ktOwner = "include";
            this.elements.push(curNode);
        }
        for (let i = this.elements.length-1; i>=0; i--) {
            this.parentElement.insertBefore(this.elements[i], this.nextSibling);
        }
    }

    _renderElements() {
        for (let curNode of this.elements)
            this.renderRecursive(curNode, context, true);
    }

    loadDataRemote() {
        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", this.params.src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + this.params.src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                let p = new KtTemplateParser();
                p.parseRecursive(this.content);
                this._appendChildFromContent();
                this._renderElements();
                return;
            }

        };

        xhttp.send();
    }


    render(context) {
        if (this.elements === null)
            this.loadDataRemote();
        else
            this._renderElements();

    }
}

customElements.define("kt-include", KtInclude, {extends: "template"});



class KtMaintain extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this.params = {
            "stmt": null
        }
    }

    static get observedAttributes() {
        return ["stmt"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }

    render(context) {

        if (this.elements === null) {
            let newNode = this.content.cloneNode(true);
            this.elements = [];
            for (let curNode of newNode.childNodes) {
                curNode.ktOwner = "maintain";
                this.elements.push(curNode);
            }
            for (let i = this.elements.length-1; i>=0; i--) {
                this.parentElement.insertBefore(this.elements[i], this.nextSibling);
            }
        }

        for (let curElement of this.elements) {
            if ( typeof curElement.hasAttribute !== "function")
                continue;
            for (let attrName in KT_FN) {

                if ( ! curElement.hasAttribute(attrName))
                    continue;
                KT_FN[attrName](curElement, curElement.getAttribute(attrName), context);
            }
            this.renderRecursive(curElement, context, true);
        }
    }
}

customElements.define("kt-maintain", KtMaintain, {extends: "template"});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9IGNcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlXG4gICAgICogQHJldHVybiB7YW55fVxuICAgICAqL1xuICAgIGtldmFsKHN0bXQsIGMsIGUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCAkID0gYztcbiAgICAgICAgICAgIHJldHVybiBldmFsKHN0bXQpXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJjYW5ub3QgZXZhbCgpIHN0bXQ6ICdcIiArIHN0bXQgKyBcIicgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsIGMsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IpIHtcbiAgICAgICAgbGV0IHIgPSBcImxldCAkID0gJHNjb3BlO1wiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IF9fdmFsID0gbnVsbDtcbiAgICAgICAgciArPSBgX192YWwgPSAke3NlbGVjdG9yfTtgO1xuICAgICAgICBldmFsKHIpO1xuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcImRlYnVnXCI6IGZhbHNlfTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IGFyZ3VtZW50cztcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY29udGV4dFxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCBjb250ZXh0LCBvd25lck5vZGVzKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJrdE93bmVyXCIpICYmIG93bmVyTm9kZXMgIT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn1cblxuXG5cbiIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLYVZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKS50cmltKCkpO1xuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKi9cbiAgICBwYXJzZVJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJba2EtdHBsXSBwYXJzZVJlY3Vyc2l2ZShcIiwgbm9kZSwgXCIpXCIpO1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IG4gb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKG4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1mb3JcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpXG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgIFwifVwiKTtcbiAgICAgICAgICAgIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSIsIi8qKlxuICpcbiAqIEByZXR1cm4gS2FUcGxcbiAqL1xuZnVuY3Rpb24ga2FfdHBsKHNlbGVjdG9yKSB7XG4gICAgaWYgKHNlbGVjdG9yIGluc3RhbmNlb2YgS2FUcGwpXG4gICAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICBsZXQgZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNlbGVjdG9yKTtcbiAgICBpZiAoZWxlbSBpbnN0YW5jZW9mIEthVHBsKSB7XG4gICAgICAgIHJldHVybiBlbGVtO1xuICAgIH1cbiAgICB0aHJvdyBgU2VsZWN0b3IgJyR7c2VsZWN0b3J9JyBpcyBub3QgYSA8dGVtcGxhdGUgaXM9XCJrYS10cGxcIj4gZWxlbWVudGA7XG59XG5cblxuXG52YXIgS1RfRk4gPSB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3QtY2xhc3Nlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluIFtkYXRhXSBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiBzY29wZSkge1xuICAgICAgICAgICAgZXZhbChgbGV0ICR7X19uYW1lfSA9IHNjb3BlWycke19fbmFtZX0nXTtgKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGNsYXNzZXMgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGUgPSBcImNsYXNzZXMgPSBcIiArIHZhbDtcbiAgICAgICAgICAgIGxldCByZXQgPSBldmFsKGUpO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJldmFsXCIsIGUsIFwicmV0OiBcIiwgcmV0LCBcImNsYXNzZXM6XCIsIGNsYXNzZXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBlICsgXCIgaW4gKmF0dHJzIG9mIFwiICsgZWxlbS5vdXRlckhUTUw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIFwiXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTsiLCJ2YXIgS0FTRUxGID0gbnVsbDtcblxuY2xhc3MgS2FUcGwgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTd2l0Y2hlZCB0byB0byBkdXJpbmcgX2luaXQoKSB0byBhbGxvdyA8c2NyaXB0PiB0byBzZXQgc2NvcGUgd2l0aG91dCByZW5kZXJpbmcuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3Njb3BlID0ge307XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSkge1xuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuXG4gICAgICAgIC8vIFJlbmRlciBvbmx5IGlmIGRvbSBhdmFpbGFibGUgKGFsbG93IDxzY3JpcHQ+IGluc2lkZSB0ZW1wbGF0ZSB0byBzZXQgc2NvcGUgYmVmb3JlIGZpcnN0IHJlbmRlcmluZ1xuICAgICAgICBpZiAoICEgdGhpcy5faXNJbml0aWFsaXppbmcpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSk7XG4gICAgfVxuXG4gICAgZ2V0ICRzY29wZSgpIHtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSB7XG4gICAgICAgICAgICBzZXQ6ICh0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSwgcmVjZWl2ZXIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgdGhpcy5fbG9nKGNuLmNoaWxkcmVuKTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwua3RPd25lciA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICB0aGlzLl9lbHMucHVzaChjZWwpO1xuICAgICAgICB9XG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1mb3JcIiwgS3RGb3IsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHN0bXQgPSB0aGlzLnBhcmFtcy5zdG10O1xuXG4gICAgICAgIGxldCBpc1RydWUgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHIuc3RtdCk7XG5cbiAgICAgICAgaWYgKGlzVHJ1ZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjdXJOb2RlLmt0T3duZXIgPSBcImlmXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGxldCBub2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtaWZcIiwgS3RJZiwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5jbGFzcyBLdEluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG5cbiAgICBsb2FkUmVtb3RlICgpIHtcblxuICAgIH1cblxuXG4gICAgX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaW5jbHVkZVwiO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVuZGVyRWxlbWVudHMoKSB7XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgIH1cblxuICAgIGxvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMucGFyYW1zLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pbmNsdWRlXCIsIEt0SW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0TWFpbnRhaW4gZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwibWFpbnRhaW5cIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN0RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9IGNcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlXG4gICAgICogQHJldHVybiB7YW55fVxuICAgICAqL1xuICAgIGtldmFsKHN0bXQsIGMsIGUpIHtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGxldCAkID0gYztcbiAgICAgICAgICAgIHJldHVybiBldmFsKHN0bXQpXG4gICAgICAgIH0gY2F0Y2ggKGV4KSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oXCJjYW5ub3QgZXZhbCgpIHN0bXQ6ICdcIiArIHN0bXQgKyBcIicgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsIGMsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IpIHtcbiAgICAgICAgbGV0IHIgPSBcImxldCAkID0gJHNjb3BlO1wiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgbGV0IF9fdmFsID0gbnVsbDtcbiAgICAgICAgciArPSBgX192YWwgPSAke3NlbGVjdG9yfTtgO1xuICAgICAgICBldmFsKHIpO1xuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcImRlYnVnXCI6IGZhbHNlfTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IGFyZ3VtZW50cztcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gY29udGV4dFxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCBjb250ZXh0LCBvd25lck5vZGVzKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoY29udGV4dCk7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJrdE93bmVyXCIpICYmIG93bmVyTm9kZXMgIT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQpO1xuICAgICAgICB9XG5cbiAgICB9XG5cbn1cblxuXG5cbiIsIlxuXG5jbGFzcyBLdFRlbXBsYXRlUGFyc2VyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdGV4dFxuICAgICAqIEBwYXJhbSB7RG9jdW1lbnRGcmFnbWVudH0gZnJhZ21lbnRcbiAgICAgKiBAcmV0dXJuIHtudWxsfVxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX3BhcnNlVGV4dE5vZGUgKHRleHQsIGZyYWdtZW50KSB7XG4gICAgICAgIGxldCBzcGxpdCA9IHRleHQuc3BsaXQoLyhcXHtcXHt8XFx9XFx9KS8pO1xuICAgICAgICB3aGlsZShzcGxpdC5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZChuZXcgVGV4dChzcGxpdC5zaGlmdCgpKSk7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAwKVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgbGV0IHZhbCA9IG5ldyBLYVZhbCgpO1xuICAgICAgICAgICAgdmFsLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgc3BsaXQuc2hpZnQoKS50cmltKCkpO1xuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKHZhbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKi9cbiAgICBwYXJzZVJlY3Vyc2l2ZShub2RlKSB7XG4gICAgICAgIC8vY29uc29sZS5sb2coXCJba2EtdHBsXSBwYXJzZVJlY3Vyc2l2ZShcIiwgbm9kZSwgXCIpXCIpO1xuICAgICAgICBpZiAobm9kZSBpbnN0YW5jZW9mIERvY3VtZW50RnJhZ21lbnQpIHtcbiAgICAgICAgICAgIGZvciAobGV0IG4gb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKG4pO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cblxuICAgICAgICBpZiAodHlwZW9mIG5vZGUuZ2V0QXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgaWYgKG5vZGUua3RQYXJzZWQgPT09IHRydWUpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbm9kZS5rdFBhcnNlZCA9IHRydWU7XG5cbiAgICAgICAgZm9yIChsZXQgdGV4dE5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHRleHROb2RlLmRhdGEgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBsZXQgZnJhZ21lbnQgPSBuZXcgRG9jdW1lbnRGcmFnbWVudCgpO1xuICAgICAgICAgICAgdGhpcy5fcGFyc2VUZXh0Tm9kZSh0ZXh0Tm9kZS5kYXRhLCBmcmFnbWVudCk7XG4gICAgICAgICAgICB0ZXh0Tm9kZS5yZXBsYWNlV2l0aChmcmFnbWVudCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1mb3JcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yc2VsZWN0XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWZcIikpIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1pZlwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlmXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcInN0bXRcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGxldCBjc3NDbGFzc2VzID0gW107XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpXG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1hdHRyc1wiLCBcIntcIiArIGF0dHJzLmpvaW4oXCIsXCIpICsgIFwifVwiKTtcbiAgICAgICAgICAgIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWNsYXNzZXNcIiwgXCJ7XCIgKyBjc3NDbGFzc2VzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSIsIi8qKlxuICpcbiAqIEByZXR1cm4gS2FUcGxcbiAqL1xuZnVuY3Rpb24ga2FfdHBsKHNlbGVjdG9yKSB7XG4gICAgaWYgKHNlbGVjdG9yIGluc3RhbmNlb2YgS2FUcGwpXG4gICAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICBsZXQgZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNlbGVjdG9yKTtcbiAgICBpZiAoZWxlbSBpbnN0YW5jZW9mIEthVHBsKSB7XG4gICAgICAgIHJldHVybiBlbGVtO1xuICAgIH1cbiAgICB0aHJvdyBgU2VsZWN0b3IgJyR7c2VsZWN0b3J9JyBpcyBub3QgYSA8dGVtcGxhdGUgaXM9XCJrYS10cGxcIj4gZWxlbWVudGA7XG59XG5cblxuXG52YXIgS1RfRk4gPSB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3QtY2xhc3Nlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluIFtkYXRhXSBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiBzY29wZSkge1xuICAgICAgICAgICAgZXZhbChgbGV0ICR7X19uYW1lfSA9IHNjb3BlWycke19fbmFtZX0nXTtgKTtcbiAgICAgICAgfVxuICAgICAgICB0cnkge1xuICAgICAgICAgICAgdmFyIGNsYXNzZXMgPSBudWxsO1xuICAgICAgICAgICAgbGV0IGUgPSBcImNsYXNzZXMgPSBcIiArIHZhbDtcbiAgICAgICAgICAgIGxldCByZXQgPSBldmFsKGUpO1xuICAgICAgICAgICAgLy8gY29uc29sZS5sb2coXCJldmFsXCIsIGUsIFwicmV0OiBcIiwgcmV0LCBcImNsYXNzZXM6XCIsIGNsYXNzZXMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICB0aHJvdyBlICsgXCIgaW4gKmF0dHJzIG9mIFwiICsgZWxlbS5vdXRlckhUTUw7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIFwiXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTsiLCJ2YXIgS0FTRUxGID0gbnVsbDtcblxuY2xhc3MgS2FUcGwgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTd2l0Y2hlZCB0byB0byBkdXJpbmcgX2luaXQoKSB0byBhbGxvdyA8c2NyaXB0PiB0byBzZXQgc2NvcGUgd2l0aG91dCByZW5kZXJpbmcuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3Njb3BlID0ge307XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSkge1xuICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSlcbiAgICAgICAgICAgIH0pO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuXG4gICAgICAgIC8vIFJlbmRlciBvbmx5IGlmIGRvbSBhdmFpbGFibGUgKGFsbG93IDxzY3JpcHQ+IGluc2lkZSB0ZW1wbGF0ZSB0byBzZXQgc2NvcGUgYmVmb3JlIGZpcnN0IHJlbmRlcmluZ1xuICAgICAgICBpZiAoICEgdGhpcy5faXNJbml0aWFsaXppbmcpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSk7XG4gICAgfVxuXG4gICAgZ2V0ICRzY29wZSgpIHtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSB7XG4gICAgICAgICAgICBzZXQ6ICh0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSwgcmVjZWl2ZXIpID0+IHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9XG5cblxuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgdGhpcy5fbG9nKGNuLmNoaWxkcmVuKTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwua3RPd25lciA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICB0aGlzLl9lbHMucHVzaChjZWwpO1xuICAgICAgICB9XG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1mb3JcIiwgS3RGb3IsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHN0bXQgPSB0aGlzLnBhcmFtcy5zdG10O1xuXG4gICAgICAgIGxldCBpc1RydWUgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHIuc3RtdCk7XG5cbiAgICAgICAgaWYgKGlzVHJ1ZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjdXJOb2RlLmt0T3duZXIgPSBcImlmXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGxldCBub2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtaWZcIiwgS3RJZiwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5jbGFzcyBLdEluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG5cbiAgICBsb2FkUmVtb3RlICgpIHtcblxuICAgIH1cblxuXG4gICAgX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaW5jbHVkZVwiO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVuZGVyRWxlbWVudHMoKSB7XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgIH1cblxuICAgIGxvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMucGFyYW1zLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pbmNsdWRlXCIsIEt0SW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0TWFpbnRhaW4gZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwibWFpbnRhaW5cIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19