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
        let events = {};

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
                    case "on":
                        events[split[1]] = node.getAttribute(attrName);
                        break;

                    default:
                        console.warn("Invalid attribute '" + attrName + "'")
                }
            }
        }

        if (attrs.length > 0 || cssClasses.length > 0 || Object.keys(events).length > 0) {
            let newNode = document.createElement("template", {is: "kt-maintain"});
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);
            if (attrs.length > 0)
                cloneNode.setAttribute("kt-attrs", "{" + attrs.join(",") +  "}");
            if (cssClasses.length > 0)
                cloneNode.setAttribute("kt-classes", "{" + cssClasses.join(",") + "}");
            if (Object.keys(events).length > 0)
                cloneNode.setAttribute("kt-on", JSON.stringify(events));
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
        let kthelper = new KtHelper();
        let classes = kthelper.scopeEval(scope, val);
        for (let className in classes) {
            if ( ! classes.hasOwnProperty(className))
                continue;
            if (classes[className] !== null && classes[className] !== false) {
                elem.setAttribute(className, classes[className]);
            } else {
                elem.removeAttribute(className);
            }
        }
    },
    "kt-on": function (elem, val, $scope) {
        let kthelper = new KtHelper();

        // Clone the first layer of the scope so it can be evaluated on event
        let saveScope = {...$scope};

        let events = JSON.parse(val);
        for (let event in events) {
            elem["on" + event] = (e) => {
                kthelper.keval(events[event], saveScope, elem);
                return false;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgJHNjb3BlLCBlKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIl07XG4gICAgICAgIGxldCByID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7cn0ke3N9JykgZmFpbGVkOiAke2V9YCk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHt9O1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHNbc3BsaXRbMV1dID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwIHx8IE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyAgXCJ9XCIpO1xuICAgICAgICAgICAgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1vblwiLCBKU09OLnN0cmluZ2lmeShldmVudHMpKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8IHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMub3V0ZXJIVE1MKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIGZvcihuIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7fTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9sb2coXCJjb25uZWN0ZWRDYWxsYmFjaygpXCIsIHRoaXMpO1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKVxuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbG9nKFwiYXV0b3N0YXJ0OiBfaW5pdCgpXCIsIFwiZG9jdW1lbnQucmVhZHlTdGF0ZTogXCIsIGRvY3VtZW50LnJlYWR5U3RhdGUpO1xuXG4gICAgICAgICAgICBsZXQgaW5pdCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG8gPT09IFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGV2YWwoYXV0byk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHNjb3BlIGFuZCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiBrYV90cGwoXCJ0cGwwMVwiKS4kc2NvcGUgPSB7bmFtZTogXCJib2JcIn07XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdmFsXG4gICAgICovXG4gICAgc2V0ICRzY29wZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB2YWw7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9ubHkgaWYgZG9tIGF2YWlsYWJsZSAoYWxsb3cgPHNjcmlwdD4gaW5zaWRlIHRlbXBsYXRlIHRvIHNldCBzY29wZSBiZWZvcmUgZmlyc3QgcmVuZGVyaW5nXG4gICAgICAgIGlmICggISB0aGlzLl9pc0luaXRpYWxpemluZylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICB9XG5cbiAgICBnZXQgJHNjb3BlKCkge1xuICAgICAgICBsZXQgaGFuZGxlciA9IHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cgKFwic2V0OlwiLCB0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIC8vIERvbid0IHVwZGF0ZSBwcm94eSBkdXJpbmcgcmVuZGVyaW5nIChyZWN1cnNpb24pXG4gICAgICAgICAgICAgICAgaWYgKCAhIHRoaXMuX2lzUmVuZGVyaW5nKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0OiAodGFyZ2V0LCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG5cblxuICAgIF9pbml0KCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGxvYWRlciBlbGVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcuaGFzQXR0cmlidXRlKFwia2EtbG9hZGVyXCIpKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLYVZhbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdEhscHIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImFmdGVycmVuZGVyXCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih7fSk7XG4gICAgfVxuICAgIF9sb2coKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKGByZW5kZXIoYCwgJHNjb3BlLCBgKSBvbiAnJHt0aGlzLm91dGVySFRNTH0nYCk7XG4gICAgICAgIHRyeSB7XG5cbiAgICAgICAgICAgIGxldCB2ID0gdGhpcy5fa3RIbHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHJzLnN0bXQpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwidW5pbmRlbnRcIikpIHtcbiAgICAgICAgICAgICAgICB2ID0gdGhpcy5fa3RIbHByLnVuaW5kZW50VGV4dCh2KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiaHRtbFwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0gdjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSB2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmFmdGVycmVuZGVyICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIGV2YWwodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRoaXMuaW5uZXJUZXh0ID0gZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtdmFsXCIsIEthVmFsKTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG5cbiAgICAgICAgaWYgKCAhIGlzVHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGxldCBhdHRyTmFtZSBpbiBLVF9GTikge1xuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksICRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCAkc2NvcGUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZFQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdEhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ2xKQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkVBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUN2R0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25IQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxSEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgJHNjb3BlLCBlKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIl07XG4gICAgICAgIGxldCByID0gXCJcIjtcbiAgICAgICAgZm9yIChsZXQgX19uYW1lIGluICRzY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gJHNjb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS53YXJuKFwiY2Fubm90IGV2YWwoKSBzdG10OiAnXCIgKyBzdG10ICsgXCInOiBcIiArIGV4ICsgXCIgb24gZWxlbWVudCBcIiwgZS5vdXRlckhUTUwsIFwiKGNvbnRleHQ6XCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICAgICAgdGhyb3cgXCJldmFsKCdcIiArIHN0bXQgKyBcIicpIGZhaWxlZDogXCIgKyBleDtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqIFJldHVybnMgYSBzdHJpbmcgdG8gYmUgZXZhbCgpJ2VkIHJlZ2lzdGVyaW5nXG4gICAgICogYWxsIHRoZSB2YXJpYWJsZXMgaW4gc2NvcGUgdG8gbWV0aG9kIGNvbnRleHRcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc2VsZWN0b3JcbiAgICAgKiBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICpcbiAgICAgKi9cbiAgICBzY29wZUV2YWwoJHNjb3BlLCBzZWxlY3Rvcikge1xuICAgICAgICBjb25zdCByZXNlcnZlZCA9IFtcInZhclwiLCBcIm51bGxcIiwgXCJsZXRcIiwgXCJjb25zdFwiLCBcImZ1bmN0aW9uXCIsIFwiY2xhc3NcIiwgXCJpblwiLCBcIm9mXCIsIFwiZm9yXCIsIFwidHJ1ZVwiLCBcImZhbHNlXCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7cn0ke3N9JykgZmFpbGVkOiAke2V9YCk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQgYXR0cnMgPSBbXTtcbiAgICAgICAgbGV0IGV2ZW50cyA9IHt9O1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIm9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBldmVudHNbc3BsaXRbMV1dID0gbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwIHx8IE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LW1haW50YWluXCJ9KTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyAgXCJ9XCIpO1xuICAgICAgICAgICAgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICBpZiAoT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1vblwiLCBKU09OLnN0cmluZ2lmeShldmVudHMpKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShjdXJOb2RlKTtcblxuXG5cbiAgICB9XG5cbn0iLCIvKipcbiAqXG4gKiBAcmV0dXJuIEthVHBsXG4gKi9cbmZ1bmN0aW9uIGthX3RwbChzZWxlY3Rvcikge1xuICAgIGlmIChzZWxlY3RvciBpbnN0YW5jZW9mIEthVHBsKVxuICAgICAgICByZXR1cm4gc2VsZWN0b3I7XG4gICAgbGV0IGVsZW0gPSBkb2N1bWVudC5nZXRFbGVtZW50QnlJZChzZWxlY3Rvcik7XG4gICAgaWYgKGVsZW0gaW5zdGFuY2VvZiBLYVRwbCkge1xuICAgICAgICByZXR1cm4gZWxlbTtcbiAgICB9XG4gICAgdGhyb3cgYFNlbGVjdG9yICcke3NlbGVjdG9yfScgaXMgbm90IGEgPHRlbXBsYXRlIGlzPVwia2EtdHBsXCI+IGVsZW1lbnRgO1xufVxuXG5cblxudmFyIEtUX0ZOID0ge1xuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LWNsYXNzZXNcIjogZnVuY3Rpb24oZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBcInVzZSBzdHJpY3RcIjtcblxuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSA9PT0gdHJ1ZSkge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LmFkZChjbGFzc05hbWUpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5yZW1vdmUoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8IHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMub3V0ZXJIVE1MKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIGZvcihuIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7fTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9sb2coXCJjb25uZWN0ZWRDYWxsYmFjaygpXCIsIHRoaXMpO1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKVxuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbG9nKFwiYXV0b3N0YXJ0OiBfaW5pdCgpXCIsIFwiZG9jdW1lbnQucmVhZHlTdGF0ZTogXCIsIGRvY3VtZW50LnJlYWR5U3RhdGUpO1xuXG4gICAgICAgICAgICBsZXQgaW5pdCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG8gPT09IFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGV2YWwoYXV0byk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHNjb3BlIGFuZCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiBrYV90cGwoXCJ0cGwwMVwiKS4kc2NvcGUgPSB7bmFtZTogXCJib2JcIn07XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdmFsXG4gICAgICovXG4gICAgc2V0ICRzY29wZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB2YWw7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9ubHkgaWYgZG9tIGF2YWlsYWJsZSAoYWxsb3cgPHNjcmlwdD4gaW5zaWRlIHRlbXBsYXRlIHRvIHNldCBzY29wZSBiZWZvcmUgZmlyc3QgcmVuZGVyaW5nXG4gICAgICAgIGlmICggISB0aGlzLl9pc0luaXRpYWxpemluZylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICB9XG5cbiAgICBnZXQgJHNjb3BlKCkge1xuICAgICAgICBsZXQgaGFuZGxlciA9IHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cgKFwic2V0OlwiLCB0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIC8vIERvbid0IHVwZGF0ZSBwcm94eSBkdXJpbmcgcmVuZGVyaW5nIChyZWN1cnNpb24pXG4gICAgICAgICAgICAgICAgaWYgKCAhIHRoaXMuX2lzUmVuZGVyaW5nKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0OiAodGFyZ2V0LCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG5cblxuICAgIF9pbml0KCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGxvYWRlciBlbGVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcuaGFzQXR0cmlidXRlKFwia2EtbG9hZGVyXCIpKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLYVZhbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdEhscHIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImFmdGVycmVuZGVyXCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih7fSk7XG4gICAgfVxuICAgIF9sb2coKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKGByZW5kZXIoYCwgJHNjb3BlLCBgKSBvbiAnJHt0aGlzLm91dGVySFRNTH0nYCk7XG4gICAgICAgIHRyeSB7XG5cbiAgICAgICAgICAgIGxldCB2ID0gdGhpcy5fa3RIbHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHJzLnN0bXQpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwidW5pbmRlbnRcIikpIHtcbiAgICAgICAgICAgICAgICB2ID0gdGhpcy5fa3RIbHByLnVuaW5kZW50VGV4dCh2KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiaHRtbFwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0gdjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSB2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmFmdGVycmVuZGVyICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIGV2YWwodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRoaXMuaW5uZXJUZXh0ID0gZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtdmFsXCIsIEthVmFsKTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG5cbiAgICAgICAgaWYgKCAhIGlzVHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGxldCBhdHRyTmFtZSBpbiBLVF9GTikge1xuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksICRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCAkc2NvcGUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19