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
        return new Proxy(this._scope, {
            set: (target, property, value, receiver) => {
                target[property] = value;
                this.render(this.$scope);
            }
        });
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
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope, true);
        }
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJrYXNpbWlyLXRwbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuY2xhc3MgS3RIZWxwZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdG10XG4gICAgICogQHBhcmFtIHtjb250ZXh0fSBjXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZVxuICAgICAqIEByZXR1cm4ge2FueX1cbiAgICAgKi9cbiAgICBrZXZhbChzdG10LCBjLCBlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgJCA9IGM7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInIG9uIGVsZW1lbnQgXCIsIGUub3V0ZXJIVE1MLCBcIihjb250ZXh0OlwiLCBjLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcImV2YWwoJ1wiICsgc3RtdCArIFwiJykgZmFpbGVkOiBcIiArIGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHN0cmluZyB0byBiZSBldmFsKCknZWQgcmVnaXN0ZXJpbmdcbiAgICAgKiBhbGwgdGhlIHZhcmlhYmxlcyBpbiBzY29wZSB0byBtZXRob2QgY29udGV4dFxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RvclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKlxuICAgICAqL1xuICAgIHNjb3BlRXZhbCgkc2NvcGUsIHNlbGVjdG9yKSB7XG4gICAgICAgIGxldCByID0gXCJsZXQgJCA9ICRzY29wZTtcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIGxldCBfX3ZhbCA9IG51bGw7XG4gICAgICAgIHIgKz0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgZXZhbChyKTtcbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuXG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2hscHIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgd2l0aCBhbGwgb2JzZXJ2ZWQgZWxlbWVudHMgb2YgdGhpcyB0ZW1wbGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBudWxsIGluZGljYXRlcywgdGhlIHRlbXBsYXRlIHdhcyBub3QgeWV0IHJlbmRlcmVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtIVE1MRWxlbWVudFtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdElkID0gKytfS1RfRUxFTUVOVF9JRDtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBfbG9nKHYxLCB2MiwgdjMpIHtcbiAgICAgICAgbGV0IGEgPSBhcmd1bWVudHM7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KHRoaXMsIGEpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNvbnRleHRcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgY29udGV4dCwgb3duZXJOb2Rlcykge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKGNvbnRleHQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwia3RPd25lclwiKSAmJiBvd25lck5vZGVzICE9PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtZm9yXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArICBcIn1cIik7XG4gICAgICAgICAgICBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgbGV0ICQgPSBzY29wZTtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluIHNjb3BlKSB7XG4gICAgICAgICAgICBldmFsKGBsZXQgJHtfX25hbWV9ID0gc2NvcGVbJyR7X19uYW1lfSddO2ApO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IG51bGw7XG4gICAgICAgICAgICBsZXQgZSA9IFwiY2xhc3NlcyA9IFwiICsgdmFsO1xuICAgICAgICAgICAgbGV0IHJldCA9IGV2YWwoZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImV2YWxcIiwgZSwgXCJyZXQ6IFwiLCByZXQsIFwiY2xhc3NlczpcIiwgY2xhc3Nlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IGUgKyBcIiBpbiBbZGF0YV0gb2YgXCIgKyBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluICphdHRycyBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBcIlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodGhpcy5fc2NvcGUsIHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICBfaW5pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyAhPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBsb2FkZXIgZWxlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nLmhhc0F0dHJpYnV0ZShcImthLWxvYWRlclwiKSlcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICB0aGlzLl9sb2coY24uY2hpbGRyZW4pO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5rdE93bmVyID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShjbiwgc2libGluZyk7XG5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcInJlbmRlcigkc2NvcGU9IFwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1mb3JcIiwgS3RGb3IsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHN0bXQgPSB0aGlzLnBhcmFtcy5zdG10O1xuXG4gICAgICAgIGxldCBpc1RydWUgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHIuc3RtdCk7XG5cbiAgICAgICAgaWYgKGlzVHJ1ZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjdXJOb2RlLmt0T3duZXIgPSBcImlmXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGxldCBub2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtaWZcIiwgS3RJZiwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5jbGFzcyBLdEluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG5cbiAgICBsb2FkUmVtb3RlICgpIHtcblxuICAgIH1cblxuXG4gICAgX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaW5jbHVkZVwiO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVuZGVyRWxlbWVudHMoKSB7XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgIH1cblxuICAgIGxvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMucGFyYW1zLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pbmNsdWRlXCIsIEt0SW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0TWFpbnRhaW4gZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwibWFpbnRhaW5cIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtdHBsLmpzIiwia2EtdmFsLmpzIiwia3QtZm9yLmpzIiwia3QtaWYuanMiLCJrdC1pbmNsdWRlLmpzIiwia3QtbWFpbnRhaW4uanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3pFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUNuR0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0VBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJrYXNpbWlyLXRwbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuY2xhc3MgS3RIZWxwZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdG10XG4gICAgICogQHBhcmFtIHtjb250ZXh0fSBjXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZVxuICAgICAqIEByZXR1cm4ge2FueX1cbiAgICAgKi9cbiAgICBrZXZhbChzdG10LCBjLCBlKSB7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBsZXQgJCA9IGM7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInIG9uIGVsZW1lbnQgXCIsIGUub3V0ZXJIVE1MLCBcIihjb250ZXh0OlwiLCBjLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcImV2YWwoJ1wiICsgc3RtdCArIFwiJykgZmFpbGVkOiBcIiArIGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHN0cmluZyB0byBiZSBldmFsKCknZWQgcmVnaXN0ZXJpbmdcbiAgICAgKiBhbGwgdGhlIHZhcmlhYmxlcyBpbiBzY29wZSB0byBtZXRob2QgY29udGV4dFxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RvclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKlxuICAgICAqL1xuICAgIHNjb3BlRXZhbCgkc2NvcGUsIHNlbGVjdG9yKSB7XG4gICAgICAgIGxldCByID0gXCJsZXQgJCA9ICRzY29wZTtcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIGxldCBfX3ZhbCA9IG51bGw7XG4gICAgICAgIHIgKz0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgZXZhbChyKTtcbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuXG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2hscHIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgd2l0aCBhbGwgb2JzZXJ2ZWQgZWxlbWVudHMgb2YgdGhpcyB0ZW1wbGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBudWxsIGluZGljYXRlcywgdGhlIHRlbXBsYXRlIHdhcyBub3QgeWV0IHJlbmRlcmVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtIVE1MRWxlbWVudFtdfVxuICAgICAgICAgKiBAcHJpdmF0ZVxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdElkID0gKytfS1RfRUxFTUVOVF9JRDtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBfbG9nKHYxLCB2MiwgdjMpIHtcbiAgICAgICAgbGV0IGEgPSBhcmd1bWVudHM7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KHRoaXMsIGEpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9IGNvbnRleHRcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgY29udGV4dCwgb3duZXJOb2Rlcykge1xuICAgICAgICBpZiAodHlwZW9mIG5vZGUucmVuZGVyID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIG5vZGUucmVuZGVyKGNvbnRleHQpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwia3RPd25lclwiKSAmJiBvd25lck5vZGVzICE9PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCBjb250ZXh0KTtcbiAgICAgICAgfVxuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtZm9yXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqZm9yXCIpO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArICBcIn1cIik7XG4gICAgICAgICAgICBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcbiAgICAgICAgbGV0ICQgPSBzY29wZTtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluIHNjb3BlKSB7XG4gICAgICAgICAgICBldmFsKGBsZXQgJHtfX25hbWV9ID0gc2NvcGVbJyR7X19uYW1lfSddO2ApO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICB2YXIgY2xhc3NlcyA9IG51bGw7XG4gICAgICAgICAgICBsZXQgZSA9IFwiY2xhc3NlcyA9IFwiICsgdmFsO1xuICAgICAgICAgICAgbGV0IHJldCA9IGV2YWwoZSk7XG4gICAgICAgICAgICAvLyBjb25zb2xlLmxvZyhcImV2YWxcIiwgZSwgXCJyZXQ6IFwiLCByZXQsIFwiY2xhc3NlczpcIiwgY2xhc3Nlcyk7XG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRocm93IGUgKyBcIiBpbiBbZGF0YV0gb2YgXCIgKyBlbGVtLm91dGVySFRNTDtcbiAgICAgICAgfVxuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQgJCA9IHNjb3BlO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gc2NvcGUpIHtcbiAgICAgICAgICAgIGV2YWwoYGxldCAke19fbmFtZX0gPSBzY29wZVsnJHtfX25hbWV9J107YCk7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHZhciBjbGFzc2VzID0gbnVsbDtcbiAgICAgICAgICAgIGxldCBlID0gXCJjbGFzc2VzID0gXCIgKyB2YWw7XG4gICAgICAgICAgICBsZXQgcmV0ID0gZXZhbChlKTtcbiAgICAgICAgICAgIC8vIGNvbnNvbGUubG9nKFwiZXZhbFwiLCBlLCBcInJldDogXCIsIHJldCwgXCJjbGFzc2VzOlwiLCBjbGFzc2VzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhyb3cgZSArIFwiIGluICphdHRycyBvZiBcIiArIGVsZW0ub3V0ZXJIVE1MO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc2V0QXR0cmlidXRlKGNsYXNzTmFtZSwgY2xhc3Nlc1tjbGFzc05hbWVdKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBcIlwiKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn07IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpIHtcbiAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpXG4gICAgICAgICAgICB9KTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIHJldHVybiBuZXcgUHJveHkodGhpcy5fc2NvcGUsIHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH0pO1xuICAgIH1cblxuXG5cbiAgICBfaW5pdCgpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyAhPT0gbnVsbClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSB0cnVlO1xuICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcgIT09IG51bGwpIHtcbiAgICAgICAgICAgIC8vIFJlbW92ZSBsb2FkZXIgZWxlbWVudFxuICAgICAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nLmhhc0F0dHJpYnV0ZShcImthLWxvYWRlclwiKSlcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcpO1xuICAgICAgICB9XG4gICAgICAgIGxldCBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIGxldCBjbiA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgICAgICB0aGlzLl9sb2coY24uY2hpbGRyZW4pO1xuICAgICAgICBmb3IgKGxldCBjZWwgb2YgY24uY2hpbGRyZW4pIHtcbiAgICAgICAgICAgIGNlbC5rdE93bmVyID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShjbiwgc2libGluZyk7XG5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcInJlbmRlcigkc2NvcGU9IFwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIGxldCBpID0gdi5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICAgICAgICAgIHYgPSB2LnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgICAgICAgICAgdiA9IHYudHJpbSgpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0Rm9yIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgdGhpcy5vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLnBhcmFtcyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBcImlkeFwiLFxuICAgICAgICAgICAgXCJmb3JldmFsXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZXZhbFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuICAgICAgICBsZXQgc2VsZWN0ID0gY29udGV4dFt0aGlzLnBhcmFtcy5mb3JzZWxlY3RdO1xuICAgICAgICBsZXQgJCA9IGNvbnRleHQ7XG4gICAgICAgIGlmICh0eXBlb2Ygc2VsZWN0ICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHt0aGlzLnBhcmFtcy5mb3JzZWxlY3R9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLm9yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KysgKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiZm9yXCI7XG4gICAgICAgICAgICAgICAgbm9kZXMucHVzaChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZShub2Rlc1tpXSwgdGhpcy5vcmlnU2libGluZyk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goe1xuICAgICAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgICAgICB9KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gMDsgaWR4IDwgc2VsZWN0Lmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGNvbnRleHRbdGhpcy5wYXJhbXMuZm9yaWR4XSA9IGlkeDtcbiAgICAgICAgICAgIGNvbnRleHRbXCJzZWxmXCJdID0gc2VsZWN0W2lkeF07XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJhbXMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMucGFyYW1zLmZvcmV2YWwsIGNvbnRleHQsIHRoaXMpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLmVsZW1lbnRzW2lkeF0ubm9kZSkge1xuICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSB0aGlzLmVsZW1lbnRzLmxlbmd0aDsgc2VsZWN0Lmxlbmd0aCA8IHRoaXMuZWxlbWVudHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLmVsZW1lbnRzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1mb3JcIiwgS3RGb3IsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgbGV0IHN0bXQgPSB0aGlzLnBhcmFtcy5zdG10O1xuXG4gICAgICAgIGxldCBpc1RydWUgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHIuc3RtdCk7XG5cbiAgICAgICAgaWYgKGlzVHJ1ZSkge1xuXG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyRWxlbWVudCwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IFtdO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgICAgICBjdXJOb2RlLmt0T3duZXIgPSBcImlmXCI7XG4gICAgICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgZm9yIChsZXQgaSA9IHRoaXMuZWxlbWVudHMubGVuZ3RoLTE7IGk+PTA7IGktLSkge1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgY29udGV4dCwgdHJ1ZSk7XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodGhpcy5lbGVtZW50cyA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICBmb3IgKGxldCBub2RlIG9mIHRoaXMuZWxlbWVudHMpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKG5vZGUpO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIH1cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia3QtaWZcIiwgS3RJZiwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5jbGFzcyBLdEluY2x1ZGUgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzcmNcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLnBhcmFtc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG5cbiAgICBsb2FkUmVtb3RlICgpIHtcblxuICAgIH1cblxuXG4gICAgX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgIHRoaXMuZWxlbWVudHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwiaW5jbHVkZVwiO1xuICAgICAgICAgICAgdGhpcy5lbGVtZW50cy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSB0aGlzLmVsZW1lbnRzLmxlbmd0aC0xOyBpPj0wOyBpLS0pIHtcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUodGhpcy5lbGVtZW50c1tpXSwgdGhpcy5uZXh0U2libGluZyk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVuZGVyRWxlbWVudHMoKSB7XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5lbGVtZW50cylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsIGNvbnRleHQsIHRydWUpO1xuICAgIH1cblxuICAgIGxvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMucGFyYW1zLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZENoaWxkRnJvbUNvbnRlbnQoKTtcbiAgICAgICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuXG4gICAgICAgIHhodHRwLnNlbmQoKTtcbiAgICB9XG5cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICBlbHNlXG4gICAgICAgICAgICB0aGlzLl9yZW5kZXJFbGVtZW50cygpO1xuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pbmNsdWRlXCIsIEt0SW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEt0TWFpbnRhaW4gZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5lbGVtZW50cyA9IG51bGw7XG4gICAgICAgIHRoaXMucGFyYW1zID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMucGFyYW1zW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICByZW5kZXIoY29udGV4dCkge1xuXG4gICAgICAgIGlmICh0aGlzLmVsZW1lbnRzID09PSBudWxsKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IHRoaXMuY29udGVudC5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICB0aGlzLmVsZW1lbnRzID0gW107XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5ld05vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgICAgIGN1ck5vZGUua3RPd25lciA9IFwibWFpbnRhaW5cIjtcbiAgICAgICAgICAgICAgICB0aGlzLmVsZW1lbnRzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBmb3IgKGxldCBpID0gdGhpcy5lbGVtZW50cy5sZW5ndGgtMTsgaT49MDsgaS0tKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50Lmluc2VydEJlZm9yZSh0aGlzLmVsZW1lbnRzW2ldLCB0aGlzLm5leHRTaWJsaW5nKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ckVsZW1lbnQgb2YgdGhpcy5lbGVtZW50cykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG5cbiAgICAgICAgICAgICAgICBpZiAoICEgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUoYXR0ck5hbWUpKVxuICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICBLVF9GTlthdHRyTmFtZV0oY3VyRWxlbWVudCwgY3VyRWxlbWVudC5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpLCBjb250ZXh0KTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsIGNvbnRleHQsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19