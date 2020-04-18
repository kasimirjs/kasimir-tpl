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

    removeNode() {
        for (let el of this._els) {
            if (typeof el.removeNode === "function")
                el.removeNode();
            this.parentElement.removeChild(el);
        }
    }

    _appendElementsToParent(sibling) {
        if (typeof sibling === "undefined")
            sibling = this.nextSibling;

        let cn = this.content.cloneNode(true);
        this._els = [];
        this._log(cn.children);
        for (let cel of cn.children) {
            cel.ktOwner = this._ktId;
            this._els.push(cel);
        }

        this.parentElement.insertBefore(cn, sibling);

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

        let kthelper = new KtHelper();
        let classes = kthelper.scopeEval(scope, val);
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
                //console.log ("set:", target, property, value);
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

        };
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

        KASELF = this;
        if (this._els === null)
            this._appendElementsToParent();

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
            for (let curNode of elem.node) {
                if (typeof curNode.removeNode === "function")
                    curNode.removeNode();
                this.parentElement.removeChild(curNode);
            }
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
        this._attrs = {
            "stmt": null,
            "debug": false
        }
    }

    static get observedAttributes() {
        return ["stmt", "debug"];
    }


    disconnectedCallback() {
        this.removeNode();
    }

    render(context) {
        if (this._els === null) {
            this._appendElementsToParent()
        }

        for (let curElement of this._els) {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gY1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgYywgZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0ICQgPSBjO1xuICAgICAgICAgICAgcmV0dXJuIGV2YWwoc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJyBvbiBlbGVtZW50IFwiLCBlLm91dGVySFRNTCwgXCIoY29udGV4dDpcIiwgYywgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBsZXQgciA9IFwibGV0ICQgPSAkc2NvcGU7XCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICBsZXQgX192YWwgPSBudWxsO1xuICAgICAgICByICs9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIGV2YWwocik7XG4gICAgICAgIHJldHVybiBfX3ZhbDtcbiAgICB9XG5cblxufSIsIlxudmFyIF9LVF9FTEVNRU5UX0lEID0gMDtcblxuY2xhc3MgS3RSZW5kZXJhYmxlIGV4dGVuZHMgSFRNTFRlbXBsYXRlRWxlbWVudCB7XG5cblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGludGVybmFsIGVsZW1lbnQgaWQgdG8gaWRlbnRpZnkgd2hpY2ggZWxlbWVudHNcbiAgICAgICAgICogdG8gcmVuZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gYXJndW1lbnRzO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjb250ZXh0XG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsIGNvbnRleHQsIG93bmVyTm9kZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcihjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcImt0T3duZXJcIikgJiYgb3duZXJOb2RlcyAhPT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVOb2RlKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwucmVtb3ZlTm9kZSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGVsLnJlbW92ZU5vZGUoKTtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYXBwZW5kRWxlbWVudHNUb1BhcmVudChzaWJsaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2libGluZyA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICB0aGlzLl9sb2coY24uY2hpbGRyZW4pO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5rdE93bmVyID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWZvclwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGF0dHJzID0gW107XG5cbiAgICAgICAgbGV0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcIl5cXFxcWyguKylcXFxcXSRcIik7XG4gICAgICAgIGZvcihsZXQgYXR0ck5hbWUgb2Ygbm9kZS5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG5cbiAgICAgICAgICAgIGxldCByZXN1bHQgPSByZWdleC5leGVjKGF0dHJOYW1lKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGxldCBzcGxpdCA9IHJlc3VsdFsxXS5zcGxpdChcIi5cIik7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgYXR0cnMucHVzaChgJyR7c3BsaXRbMF19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3BsaXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImNsYXNzbGlzdFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzQ2xhc3Nlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCBhdHRyaWJ1dGUgJ1wiICsgYXR0ck5hbWUgKyBcIidcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMCB8fCBjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1tYWludGFpblwifSk7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSlcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyAgXCJ9XCIpO1xuICAgICAgICAgICAgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluICphdHRycyBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBcIlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBLQVNFTEYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUucmVtb3ZlTm9kZSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgICAgICBjdXJOb2RlLnJlbW92ZU5vZGUoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWZvclwiLCBLdEZvciwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc3RtdCA9IHRoaXMucGFyYW1zLnN0bXQ7XG5cbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0ci5zdG10KTtcblxuICAgICAgICBpZiAoaXNUcnVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaWZcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGZvciAobGV0IG5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cbmNsYXNzIEt0SW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cblxuICAgIGxvYWRSZW1vdGUgKCkge1xuXG4gICAgfVxuXG5cbiAgICBfYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJpbmNsdWRlXCI7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW5kZXJFbGVtZW50cygpIHtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5wYXJhbXMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLmxvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWluY2x1ZGVcIiwgS3RJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVOb2RlKCk7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNoR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDN0RBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN6RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDeERBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvRUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gY1xuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgYywgZSkge1xuICAgICAgICB0cnkge1xuICAgICAgICAgICAgbGV0ICQgPSBjO1xuICAgICAgICAgICAgcmV0dXJuIGV2YWwoc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJyBvbiBlbGVtZW50IFwiLCBlLm91dGVySFRNTCwgXCIoY29udGV4dDpcIiwgYywgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBsZXQgciA9IFwibGV0ICQgPSAkc2NvcGU7XCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICBsZXQgX192YWwgPSBudWxsO1xuICAgICAgICByICs9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIGV2YWwocik7XG4gICAgICAgIHJldHVybiBfX3ZhbDtcbiAgICB9XG5cblxufSIsIlxudmFyIF9LVF9FTEVNRU5UX0lEID0gMDtcblxuY2xhc3MgS3RSZW5kZXJhYmxlIGV4dGVuZHMgSFRNTFRlbXBsYXRlRWxlbWVudCB7XG5cblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGludGVybmFsIGVsZW1lbnQgaWQgdG8gaWRlbnRpZnkgd2hpY2ggZWxlbWVudHNcbiAgICAgICAgICogdG8gcmVuZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gYXJndW1lbnRzO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSBjb250ZXh0XG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsIGNvbnRleHQsIG93bmVyTm9kZXMpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcihjb250ZXh0KTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcImt0T3duZXJcIikgJiYgb3duZXJOb2RlcyAhPT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBmb3IobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZE5vZGVzKSB7XG4gICAgICAgICAgICBpZiAobm9kZS5rdFNraXBSZW5kZXIgPT09IHRydWUpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICByZW1vdmVOb2RlKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwucmVtb3ZlTm9kZSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgIGVsLnJlbW92ZU5vZGUoKTtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfYXBwZW5kRWxlbWVudHNUb1BhcmVudChzaWJsaW5nKSB7XG4gICAgICAgIGlmICh0eXBlb2Ygc2libGluZyA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICB0aGlzLl9sb2coY24uY2hpbGRyZW4pO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5rdE93bmVyID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWZvclwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgYXR0cik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGF0dHJzID0gW107XG5cbiAgICAgICAgbGV0IHJlZ2V4ID0gbmV3IFJlZ0V4cChcIl5cXFxcWyguKylcXFxcXSRcIik7XG4gICAgICAgIGZvcihsZXQgYXR0ck5hbWUgb2Ygbm9kZS5nZXRBdHRyaWJ1dGVOYW1lcygpKSB7XG5cbiAgICAgICAgICAgIGxldCByZXN1bHQgPSByZWdleC5leGVjKGF0dHJOYW1lKTtcbiAgICAgICAgICAgIGlmIChyZXN1bHQgPT09IG51bGwpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG5cbiAgICAgICAgICAgIGxldCBzcGxpdCA9IHJlc3VsdFsxXS5zcGxpdChcIi5cIik7XG4gICAgICAgICAgICBpZiAoc3BsaXQubGVuZ3RoID09PSAxKSB7XG4gICAgICAgICAgICAgICAgYXR0cnMucHVzaChgJyR7c3BsaXRbMF19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHN3aXRjaCAoc3BsaXRbMF0pIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcImNsYXNzbGlzdFwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzQ2xhc3Nlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiSW52YWxpZCBhdHRyaWJ1dGUgJ1wiICsgYXR0ck5hbWUgKyBcIidcIilcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMCB8fCBjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1tYWludGFpblwifSk7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSlcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyAgXCJ9XCIpO1xuICAgICAgICAgICAgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluICphdHRycyBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBcIlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBLQVNFTEYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUucmVtb3ZlTm9kZSA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgICAgICBjdXJOb2RlLnJlbW92ZU5vZGUoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWZvclwiLCBLdEZvciwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc3RtdCA9IHRoaXMucGFyYW1zLnN0bXQ7XG5cbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0ci5zdG10KTtcblxuICAgICAgICBpZiAoaXNUcnVlKSB7XG5cbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaWZcIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0LCB0cnVlKTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIGZvciAobGV0IG5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQobm9kZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgfVxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cbmNsYXNzIEt0SW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLmVsZW1lbnRzID0gbnVsbDtcbiAgICAgICAgdGhpcy5wYXJhbXMgPSB7XG4gICAgICAgICAgICBcInNyY1wiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cblxuICAgIGxvYWRSZW1vdGUgKCkge1xuXG4gICAgfVxuXG5cbiAgICBfYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgY3VyTm9kZS5rdE93bmVyID0gXCJpbmNsdWRlXCI7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIF9yZW5kZXJFbGVtZW50cygpIHtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgfVxuXG4gICAgbG9hZERhdGFSZW1vdGUoKSB7XG4gICAgICAgIGxldCB4aHR0cCA9IG5ldyBYTUxIdHRwUmVxdWVzdCgpO1xuXG4gICAgICAgIHhodHRwLm9wZW4oXCJHRVRcIiwgdGhpcy5wYXJhbXMuc3JjKTtcbiAgICAgICAgeGh0dHAub25yZWFkeXN0YXRlY2hhbmdlID0gKCkgPT4ge1xuICAgICAgICAgICAgaWYgKHhodHRwLnJlYWR5U3RhdGUgPT09IDQpIHtcbiAgICAgICAgICAgICAgICBpZiAoeGh0dHAuc3RhdHVzID49IDQwMCkge1xuICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJDYW4ndCBsb2FkICdcIiArIHRoaXMucGFyYW1zLnNyYyArIFwiJzogXCIgKyB4aHR0cC5yZXNwb25zZVRleHQpO1xuICAgICAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0geGh0dHAucmVzcG9uc2VUZXh0O1xuICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICBwLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kQ2hpbGRGcm9tQ29udGVudCgpO1xuICAgICAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuZWxlbWVudHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLmxvYWREYXRhUmVtb3RlKCk7XG4gICAgICAgIGVsc2VcbiAgICAgICAgICAgIHRoaXMuX3JlbmRlckVsZW1lbnRzKCk7XG5cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWluY2x1ZGVcIiwgS3RJbmNsdWRlLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5yZW1vdmVOb2RlKCk7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19