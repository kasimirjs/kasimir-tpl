/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @see https://infracamp.org/project/kasimir
 * @author Matthias Leuffen <m@tth.es>
 */

class KtHelper {


    /**
     *
     * @param {string} stmt
     * @param {context} $scope
     * @param {HTMLElement} e
     * @return {any}
     */
    keval(stmt, $scope, e) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false"];
        let r = "";
        for (let __name in $scope) {
            if (reserved.indexOf(__name) !== -1)
                continue;
            r += `var ${__name} = $scope['${__name}'];`
        }
        try {
            return eval(r + stmt)
        } catch (ex) {
            console.warn("cannot eval() stmt: '" + stmt + "': " + ex + " on element ", e.outerHTML, "(context:", $scope, ")");
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
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false"];
        let r = "";
        for (let __name in $scope) {
            if (reserved.indexOf(__name) !== -1)
                continue;
            r += `var ${__name} = $scope['${__name}'];`
        }
        var __val = null;
        let s = `__val = ${selector};`;
        //console.log(r);
        try {
            eval(r + s);
        } catch (e) {
            console.error(`scopeEval('${r}${s}') failed: ${e}`);
            throw `eval('${s}') failed: ${e}`;
        }
        return __val;
    }

    /**
     *  Find the first whitespaces in text and remove them from the
     *  start of the following lines.
     *
     *  @param {string} str
     *  @return {string}
     */
    unindentText(str) {
        let i = str.match(/\n(\s*)/m)[1];
        str = str.replace(new RegExp(`\n${i}`, "g"), "\n");
        str = str.trim();
        return str;
    }


}

var _KT_ELEMENT_ID = 0;

class KtRenderable extends HTMLTemplateElement {



    constructor() {
        super();
        /**
         *
         * @type {KtHelper}
         * @protected
         */
        this._hlpr = new KtHelper();

        /**
         * Array with all observed elements of this template
         *
         * null indicates, the template was not yet rendered
         *
         * @type {HTMLElement[]}
         * @protected
         */
        this._els = null;
        this._attrs = {"debug": false};

        /**
         * The internal element id to identify which elements
         * to render.
         *
         * @type {number}
         * @protected
         */
        this._ktId = ++_KT_ELEMENT_ID;
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this._attrs[attrName] = newVal;
    }

    _log(v1, v2, v3) {
        let a = [ this.constructor.name + "#" + this.id + "[" + this._ktId + "]:"];

        for (let e of arguments)
            a.push(e);

        if (this._attrs.debug !== false)
            console.log.apply(this, a);
    }


    /**
     * Walk through all elements and try to render them.
     *
     * if a element has the _kaMb (maintained by) property set,
     * check if it equals this._kaId (the element id). If not,
     * skip this node.
     *
     *
     * @param {HTMLElement} node
     * @param {object} $scope
     */
    renderRecursive(node, $scope) {
        if (node.hasOwnProperty("_kaMb") && node._kaMb !== this._ktId)
            return;


        if (typeof node.render === "function") {
            node.render($scope);
            return;
        }

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, $scope);
        }
    }

    _removeNodes() {
        if (this._els === null)
            return;
        for (let el of this._els) {
            if (typeof el._removeNodes === "function")
                el._removeNodes();
            if (this.parentElement !== null)
                this.parentElement.removeChild(el);
        }
        this._els = null;
    }

    /**
     * Clone and append all elements in
     * content of template to the next sibling.
     *
     * @param sibling
     * @protected
     */
    _appendElementsToParent(sibling) {
        if (typeof sibling === "undefined")
            sibling = this.nextSibling;

        let cn = this.content.cloneNode(true);
        this._els = [];
        for (let cel of cn.children) {
            cel._kaMb = this._ktId;
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

        if (node.tagName === "SCRIPT")
            return; // Don't parse beween <script></script> tags

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
            let newNode = document.createElement("template", {is: "ka-loop"});
            let attr = node.getAttribute("*for");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);

            let ma = attr.match(/let\s+(\S*)\s+(in|of|repeat)\s+(\S*)(\s+indexby\s+(\S*))?/);
            if (ma !== null) {
                newNode.setAttribute("formode", ma[2]);
                newNode.setAttribute("forselect", ma[3]);
                newNode.setAttribute("fordata", ma[1]);
                if (typeof ma[5] !== "undefined")
                    newNode.setAttribute("foridx", ma[5]);
                if (node.hasAttribute("*foreval")) {
                    newNode.setAttribute("foreval", node.getAttribute("*foreval"));
                }
            } else {
                throw "Cannot parse *for='" + attr + "' for element " + node.outerHTML;
            }

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
        let kthelper = new KtHelper();
        let classes = kthelper.scopeEval(scope, val);
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


class KaInclude extends KtRenderable {


    constructor() {
        super();
        this._attrs = {
            "src": null,
            "auto": null,
            "raw": null,
            "debug": false
        }
    }

    static get observedAttributes() {
        return ["src", "debug", "auto", "raw"];
    }


    /**
     * <script> tags that were loaded via ajax won't be executed
     * when added to dom.
     *
     * Therefore we have to rewrite them. This method does this
     * automatically both for normal and for template (content) nodes.
     *
     * @param node
     * @private
     */
    _importScritpRecursive(node) {
        let chels = node instanceof HTMLTemplateElement ? node.content.childNodes : node.childNodes;

        for (let s of chels) {
            if (s.tagName !== "SCRIPT") {
                this._importScritpRecursive(s);
                continue;
            }
            let n = document.createElement("script");
            n.innerHTML = s.innerHTML;
            s.replaceWith(n);
        }
    }


    _loadDataRemote() {
        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", this._attrs.src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + this.params.src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                if (this._attrs.raw !== null) {
                    let p = new KtTemplateParser();
                    p.parseRecursive(this.content);
                }

                // Nodes loaded from remote won't get executed. So import them.
                this._importScritpRecursive(this.content);

                this._appendElementsToParent();
                for (let el of this._els) {
                    this._log("trigger DOMContentLoaded event on", el);
                    el.dispatchEvent(new Event("DOMContentLoaded"));
                }
                return;
            }

        };

        xhttp.send();
    }

    disconnectedCallback() {
        for (let el of this._els)
            this.parentElement.removeChild(el);
    }

    connectedCallback() {
        let auto = this.getAttribute("auto");
        if (auto !== null) {
            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    this._loadDataRemote();
                });
            } else {
                this._loadDataRemote();
            }
        }
    }

    render(context) {
        if (this._els === null)
            this._appendElementsToParent();


    }
}

customElements.define("ka-include", KaInclude, {extends: "template"});



class KaLoop extends KtRenderable {


    constructor() {
        super();
        this._origSibling = false;
        this._attrs = {
            "forselect": null,
            "formode": null,
            "foridx": null,
            "fordata": null,
            "foreval": null
        }
        this._els = [];
    }

    static get observedAttributes() {
        return ["forselect", "foridx", "fordata", "foreval", "formode"];
    }


    _appendElem() {
        let newNode = this.content.cloneNode(true);
        let nodes = [];
        for (let curNode of newNode.children) {
            curNode._kaMb = this._ktId;
            nodes.push(curNode);
        }
        for (let i = 0; i < nodes.length; i++)
            this.parentElement.insertBefore(nodes[i], this._origSibling);
        this._els.push({
            node: nodes
        });
    }


    _maintainNode(i, $scope) {
        if (this._els.length < i+1)
            this._appendElem();
        if (this._attrs.foridx !== null)
            $scope[this._attrs.foridx] = i;

        if (this._attrs.foreval !== null)
            this._hlpr.keval(this._attrs.foreval, $scope, this);

        for (let curNode of this._els[i].node) {
            this.renderRecursive(curNode, $scope);
        }
    }


    render($scope) {
        let _a_sel = this._attrs.forselect;
        let sel = this._hlpr.scopeEval($scope, _a_sel);

        if (typeof sel !== "object") {
            console.warn(`Invalid forSelect="${_a_sel}" returned:`, select, "on context", context, "(Element: ", this.outerHTML, ")");
            throw "Invalid forSelect selector. see waring."
        }

        if (sel === null || typeof sel[Symbol.iterator] !== "function") {
            this._log(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this.outerHTML);
            console.warn(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this.outerHTML)
            return;
        }

        if (this._origSibling === false)
            this._origSibling = this.nextSibling;


        let n = 0;
        switch (this._attrs.formode) {
            case "in":
                for(n in sel) {
                    $scope[this._attrs.fordata] = n;
                    this._maintainNode(n, $scope);
                }
                break;

            case "of":
                n = 0;
                for (let i of sel) {

                    $scope[this._attrs.fordata] = i;
                    this._maintainNode(n, $scope);
                    n++;
                }
                break;

            case "repeat":
                for (n=0; n < sel; n++) {
                    $scope[this._attrs.fordata] = n;
                    this._maintainNode(n, $scope);
                    n++;
                }
                break;
            default:
                throw "Invalid for type '" + this._attrs.formode + "' in " . this.outerHTML;
        }


        for (let idx = n; sel.length < this._els.length; idx++) {
            let elem = this._els.pop();
            for (let curNode of elem.node) {
                if (typeof curNode._removeNodes === "function")
                    curNode._removeNodes();
                this.parentElement.removeChild(curNode);
            }
        }
    }
}

customElements.define("ka-loop", KaLoop, {extends: "template"});
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
        this._log("connectedCallback()", this);
        let auto = this.getAttribute("auto")
        if (auto !== null) {
            this._log("autostart: _init()", "document.readyState: ", document.readyState);

            let init = () => {
                this._init();
                if (auto === "")
                    this.render(this._scope);
                else
                    eval(auto);
            };

            if (document.readyState === "loading") {
                document.addEventListener("DOMContentLoaded", () => {
                    init();
                })
            } else {
                init();
            }
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
            this.renderRecursive(ce, $scope);
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
            if (typeof v === "object")
                v = JSON.stringify(v);

            if (this.hasAttribute("unindent")) {
                v = this._ktHlpr.unindentText(v);
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



class KtIf extends KtRenderable {
    constructor() {
        super();
        this._attrs = {
            "stmt": null
        }
    }

    static get observedAttributes() {
        return ["stmt"];
    }

    render($scope) {
        let isTrue = this._hlpr.scopeEval($scope, this._attrs.stmt);

        if ( ! isTrue) {
            this._removeNodes();
            return;
        }
        if (this._els === null) {
            this._appendElementsToParent();
        }

        for (let curNode of this._els)
            this.renderRecursive(curNode, $scope);
    }
}

customElements.define("kt-if", KtIf, {extends: "template"});



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
        this._removeNodes();
    }

    render($scope) {
        if (this._els === null) {
            this._appendElementsToParent()
        }

        for (let curElement of this._els) {
            if ( typeof curElement.hasAttribute !== "function")
                continue;
            for (let attrName in KT_FN) {
                if ( ! curElement.hasAttribute(attrName))
                    continue;
                KT_FN[attrName](curElement, curElement.getAttribute(attrName), $scope);
            }
            this.renderRecursive(curElement, $scope, true);
        }
    }
}

customElements.define("kt-maintain", KtMaintain, {extends: "template"});
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgJHNjb3BlLCBlKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIl07XG4gICAgICAgIGxldCByID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7cn0ke3N9JykgZmFpbGVkOiAke2V9YCk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArICBcIn1cIik7XG4gICAgICAgICAgICBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIFwiXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTsiLCJcblxuY2xhc3MgS2FJbmNsdWRlIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYXV0b1wiOiBudWxsLFxuICAgICAgICAgICAgXCJyYXdcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3JjXCIsIFwiZGVidWdcIiwgXCJhdXRvXCIsIFwicmF3XCJdO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogPHNjcmlwdD4gdGFncyB0aGF0IHdlcmUgbG9hZGVkIHZpYSBhamF4IHdvbid0IGJlIGV4ZWN1dGVkXG4gICAgICogd2hlbiBhZGRlZCB0byBkb20uXG4gICAgICpcbiAgICAgKiBUaGVyZWZvcmUgd2UgaGF2ZSB0byByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGRvZXMgdGhpc1xuICAgICAqIGF1dG9tYXRpY2FsbHkgYm90aCBmb3Igbm9ybWFsIGFuZCBmb3IgdGVtcGxhdGUgKGNvbnRlbnQpIG5vZGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbXBvcnRTY3JpdHBSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICBsZXQgY2hlbHMgPSBub2RlIGluc3RhbmNlb2YgSFRNTFRlbXBsYXRlRWxlbWVudCA/IG5vZGUuY29udGVudC5jaGlsZE5vZGVzIDogbm9kZS5jaGlsZE5vZGVzO1xuXG4gICAgICAgIGZvciAobGV0IHMgb2YgY2hlbHMpIHtcbiAgICAgICAgICAgIGlmIChzLnRhZ05hbWUgIT09IFwiU0NSSVBUXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUocyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICBuLmlubmVySFRNTCA9IHMuaW5uZXJIVE1MO1xuICAgICAgICAgICAgcy5yZXBsYWNlV2l0aChuKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgX2xvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMuX2F0dHJzLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMucmF3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vZGVzIGxvYWRlZCBmcm9tIHJlbW90ZSB3b24ndCBnZXQgZXhlY3V0ZWQuIFNvIGltcG9ydCB0aGVtLlxuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2coXCJ0cmlnZ2VyIERPTUNvbnRlbnRMb2FkZWQgZXZlbnQgb25cIiwgZWwpO1xuICAgICAgICAgICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChcIkRPTUNvbnRlbnRMb2FkZWRcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcblxuICAgICAgICB4aHR0cC5zZW5kKCk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpO1xuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1pbmNsdWRlXCIsIEthSW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEthTG9vcCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcm1vZGVcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yaWR4XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmRhdGFcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJmb3JzZWxlY3RcIiwgXCJmb3JpZHhcIiwgXCJmb3JkYXRhXCIsIFwiZm9yZXZhbFwiLCBcImZvcm1vZGVcIl07XG4gICAgfVxuXG5cbiAgICBfYXBwZW5kRWxlbSgpIHtcbiAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjdXJOb2RlLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIG5vZGVzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMuX29yaWdTaWJsaW5nKTtcbiAgICAgICAgdGhpcy5fZWxzLnB1c2goe1xuICAgICAgICAgICAgbm9kZTogbm9kZXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICBfbWFpbnRhaW5Ob2RlKGksICRzY29wZSkge1xuICAgICAgICBpZiAodGhpcy5fZWxzLmxlbmd0aCA8IGkrMSlcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW0oKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmlkeCAhPT0gbnVsbClcbiAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JpZHhdID0gaTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2hscHIua2V2YWwodGhpcy5fYXR0cnMuZm9yZXZhbCwgJHNjb3BlLCB0aGlzKTtcblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2Vsc1tpXS5ub2RlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGxldCBfYV9zZWwgPSB0aGlzLl9hdHRycy5mb3JzZWxlY3Q7XG4gICAgICAgIGxldCBzZWwgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIF9hX3NlbCk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgSW52YWxpZCBmb3JTZWxlY3Q9XCIke19hX3NlbH1cIiByZXR1cm5lZDpgLCBzZWxlY3QsIFwib24gY29udGV4dFwiLCBjb250ZXh0LCBcIihFbGVtZW50OiBcIiwgdGhpcy5vdXRlckhUTUwsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3JTZWxlY3Qgc2VsZWN0b3IuIHNlZSB3YXJpbmcuXCJcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWwgPT09IG51bGwgfHwgdHlwZW9mIHNlbFtTeW1ib2wuaXRlcmF0b3JdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpO1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzLm91dGVySFRNTClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cblxuICAgICAgICBsZXQgbiA9IDA7XG4gICAgICAgIHN3aXRjaCAodGhpcy5fYXR0cnMuZm9ybW9kZSkge1xuICAgICAgICAgICAgY2FzZSBcImluXCI6XG4gICAgICAgICAgICAgICAgZm9yKG4gaW4gc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIm9mXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBzZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcInJlcGVhdFwiOlxuICAgICAgICAgICAgICAgIGZvciAobj0wOyBuIDwgc2VsOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gbjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3IgdHlwZSAnXCIgKyB0aGlzLl9hdHRycy5mb3Jtb2RlICsgXCInIGluIFwiIC4gdGhpcy5vdXRlckhUTUw7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IG47IHNlbC5sZW5ndGggPCB0aGlzLl9lbHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLl9lbHMucG9wKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIGVsZW0ubm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyTm9kZS5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICAgICAgY3VyTm9kZS5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWxvb3BcIiwgS2FMb29wLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcImNvbm5lY3RlZENhbGxiYWNrKClcIiwgdGhpcyk7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpXG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coXCJhdXRvc3RhcnQ6IF9pbml0KClcIiwgXCJkb2N1bWVudC5yZWFkeVN0YXRlOiBcIiwgZG9jdW1lbnQucmVhZHlTdGF0ZSk7XG5cbiAgICAgICAgICAgIGxldCBpbml0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICBpZiAoYXV0byA9PT0gXCJcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgZXZhbChhdXRvKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBLQVNFTEYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMzSUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDckRBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgJHNjb3BlLCBlKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIl07XG4gICAgICAgIGxldCByID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7cn0ke3N9JykgZmFpbGVkOiAke2V9YCk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBjc3NDbGFzc2VzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKVxuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArICBcIn1cIik7XG4gICAgICAgICAgICBpZiAoY3NzQ2xhc3Nlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCAkID0gc2NvcGU7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIFwiXCIpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufTsiLCJcblxuY2xhc3MgS2FJbmNsdWRlIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYXV0b1wiOiBudWxsLFxuICAgICAgICAgICAgXCJyYXdcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3JjXCIsIFwiZGVidWdcIiwgXCJhdXRvXCIsIFwicmF3XCJdO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogPHNjcmlwdD4gdGFncyB0aGF0IHdlcmUgbG9hZGVkIHZpYSBhamF4IHdvbid0IGJlIGV4ZWN1dGVkXG4gICAgICogd2hlbiBhZGRlZCB0byBkb20uXG4gICAgICpcbiAgICAgKiBUaGVyZWZvcmUgd2UgaGF2ZSB0byByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGRvZXMgdGhpc1xuICAgICAqIGF1dG9tYXRpY2FsbHkgYm90aCBmb3Igbm9ybWFsIGFuZCBmb3IgdGVtcGxhdGUgKGNvbnRlbnQpIG5vZGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbXBvcnRTY3JpdHBSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICBsZXQgY2hlbHMgPSBub2RlIGluc3RhbmNlb2YgSFRNTFRlbXBsYXRlRWxlbWVudCA/IG5vZGUuY29udGVudC5jaGlsZE5vZGVzIDogbm9kZS5jaGlsZE5vZGVzO1xuXG4gICAgICAgIGZvciAobGV0IHMgb2YgY2hlbHMpIHtcbiAgICAgICAgICAgIGlmIChzLnRhZ05hbWUgIT09IFwiU0NSSVBUXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUocyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICBuLmlubmVySFRNTCA9IHMuaW5uZXJIVE1MO1xuICAgICAgICAgICAgcy5yZXBsYWNlV2l0aChuKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgX2xvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMuX2F0dHJzLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMucmF3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vZGVzIGxvYWRlZCBmcm9tIHJlbW90ZSB3b24ndCBnZXQgZXhlY3V0ZWQuIFNvIGltcG9ydCB0aGVtLlxuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2coXCJ0cmlnZ2VyIERPTUNvbnRlbnRMb2FkZWQgZXZlbnQgb25cIiwgZWwpO1xuICAgICAgICAgICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChcIkRPTUNvbnRlbnRMb2FkZWRcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcblxuICAgICAgICB4aHR0cC5zZW5kKCk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpO1xuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1pbmNsdWRlXCIsIEthSW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEthTG9vcCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcm1vZGVcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yaWR4XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmRhdGFcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJmb3JzZWxlY3RcIiwgXCJmb3JpZHhcIiwgXCJmb3JkYXRhXCIsIFwiZm9yZXZhbFwiLCBcImZvcm1vZGVcIl07XG4gICAgfVxuXG5cbiAgICBfYXBwZW5kRWxlbSgpIHtcbiAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjdXJOb2RlLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIG5vZGVzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMuX29yaWdTaWJsaW5nKTtcbiAgICAgICAgdGhpcy5fZWxzLnB1c2goe1xuICAgICAgICAgICAgbm9kZTogbm9kZXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICBfbWFpbnRhaW5Ob2RlKGksICRzY29wZSkge1xuICAgICAgICBpZiAodGhpcy5fZWxzLmxlbmd0aCA8IGkrMSlcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW0oKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmlkeCAhPT0gbnVsbClcbiAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JpZHhdID0gaTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2hscHIua2V2YWwodGhpcy5fYXR0cnMuZm9yZXZhbCwgJHNjb3BlLCB0aGlzKTtcblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2Vsc1tpXS5ub2RlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGxldCBfYV9zZWwgPSB0aGlzLl9hdHRycy5mb3JzZWxlY3Q7XG4gICAgICAgIGxldCBzZWwgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIF9hX3NlbCk7XG5cbiAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgSW52YWxpZCBmb3JTZWxlY3Q9XCIke19hX3NlbH1cIiByZXR1cm5lZDpgLCBzZWxlY3QsIFwib24gY29udGV4dFwiLCBjb250ZXh0LCBcIihFbGVtZW50OiBcIiwgdGhpcy5vdXRlckhUTUwsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3JTZWxlY3Qgc2VsZWN0b3IuIHNlZSB3YXJpbmcuXCJcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChzZWwgPT09IG51bGwgfHwgdHlwZW9mIHNlbFtTeW1ib2wuaXRlcmF0b3JdICE9PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpO1xuICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzLm91dGVySFRNTClcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0aGlzLl9vcmlnU2libGluZyA9PT0gZmFsc2UpXG4gICAgICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cblxuICAgICAgICBsZXQgbiA9IDA7XG4gICAgICAgIHN3aXRjaCAodGhpcy5fYXR0cnMuZm9ybW9kZSkge1xuICAgICAgICAgICAgY2FzZSBcImluXCI6XG4gICAgICAgICAgICAgICAgZm9yKG4gaW4gc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcIm9mXCI6XG4gICAgICAgICAgICAgICAgbiA9IDA7XG4gICAgICAgICAgICAgICAgZm9yIChsZXQgaSBvZiBzZWwpIHtcblxuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBpO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgbisrO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgY2FzZSBcInJlcGVhdFwiOlxuICAgICAgICAgICAgICAgIGZvciAobj0wOyBuIDwgc2VsOyBuKyspIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gbjtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3IgdHlwZSAnXCIgKyB0aGlzLl9hdHRycy5mb3Jtb2RlICsgXCInIGluIFwiIC4gdGhpcy5vdXRlckhUTUw7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IG47IHNlbC5sZW5ndGggPCB0aGlzLl9lbHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLl9lbHMucG9wKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIGVsZW0ubm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyTm9kZS5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICAgICAgY3VyTm9kZS5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWxvb3BcIiwgS2FMb29wLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9zY29wZSA9IHt9O1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImRlYnVnXCJdO1xuICAgIH1cblxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIHRoaXMuX2xvZyhcImNvbm5lY3RlZENhbGxiYWNrKClcIiwgdGhpcyk7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpXG4gICAgICAgIGlmIChhdXRvICE9PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coXCJhdXRvc3RhcnQ6IF9pbml0KClcIiwgXCJkb2N1bWVudC5yZWFkeVN0YXRlOiBcIiwgZG9jdW1lbnQucmVhZHlTdGF0ZSk7XG5cbiAgICAgICAgICAgIGxldCBpbml0ID0gKCkgPT4ge1xuICAgICAgICAgICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgICAgICAgICBpZiAoYXV0byA9PT0gXCJcIilcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgICAgICAgICAgICAgIGVsc2VcbiAgICAgICAgICAgICAgICAgICAgZXZhbChhdXRvKTtcbiAgICAgICAgICAgIH07XG5cbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgICAgIH0pXG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFNldCB0aGUgc2NvcGUgYW5kIHJlbmRlciB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIGBgYFxuICAgICAqIGthX3RwbChcInRwbDAxXCIpLiRzY29wZSA9IHtuYW1lOiBcImJvYlwifTtcbiAgICAgKiBgYGBcbiAgICAgKlxuICAgICAqIEBwYXJhbSB2YWxcbiAgICAgKi9cbiAgICBzZXQgJHNjb3BlKHZhbCkge1xuICAgICAgICB0aGlzLl9zY29wZSA9IHZhbDtcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cblxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG4gICAgICAgIChuZXcgS3RUZW1wbGF0ZVBhcnNlcikucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICBLQVNFTEYgPSB0aGlzO1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIHRoaXMuX2luaXQoKTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSB0cnVlO1xuICAgICAgICBmb3IobGV0IGNlIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY2UsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLXRwbFwiLCBLYVRwbCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=