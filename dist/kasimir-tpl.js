/**
 * Infracamp's Kasimir Templates
 *
 * A no-dependency render on request
 *
 * @licence
 * @see https://infracamp.org/project/kasimir
 * @author Matthias Leuffen <m@tth.es>
 */

class KtHelper {


    /**
     *
     * @param {string} stmt
     * @param {context} __scope
     * @param {HTMLElement} e
     * @return {any}
     */
    keval(stmt, __scope, e) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false"];
        let r = "";
        for (let __name in __scope) {
            if (reserved.indexOf(__name) !== -1)
                continue;
            r += `var ${__name} = __scope['${__name}'];`
        }
        // If the scope was cloned, the original will be in $scope. This is important when
        // Using events [on.click], e.g.
        if (typeof __scope.$scope === "undefined") {
            r += "var $scope = __scope;";
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
        let ktClasses = null;
        let attrs = [];
        let events = {};
        let styles = [];

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
                        if (split[1] === "") {
                            ktClasses = node.getAttribute(attrName);
                            continue;
                        }

                        cssClasses.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;

                    case "on":
                        events[split[1]] = node.getAttribute(attrName);
                        break;

                    case "style":
                        styles.push(`'${split[1]}': ` + node.getAttribute(attrName));
                        break;

                    default:
                        console.warn("Invalid attribute '" + attrName + "'")
                }
            }
        }

        if (attrs.length > 0 || cssClasses.length > 0 || ktClasses !== null || Object.keys(events).length > 0 || styles.length > 0) {
            let newNode = document.createElement("template", {is: "kt-maintain"});
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true);
            newNode.content.appendChild(cloneNode);


            if (attrs.length > 0)
                cloneNode.setAttribute("kt-attrs", "{" + attrs.join(",") + "}");

            if (styles.length > 0)
                cloneNode.setAttribute("kt-styles", "{" + styles.join(",") + "}");

            if (ktClasses !== null) {
                // include [classlist.]="{class: cond}"
                cloneNode.setAttribute("kt-classes", ktClasses);
            } else if (cssClasses.length > 0) {
                cloneNode.setAttribute("kt-classes", "{" + cssClasses.join(",") + "}");
            }

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

    /**
     *
     * @param {HTMLElement} elem
     * @param {string} val
     * @param scope
     */
    "kt-styles": function(elem, val, scope) {
        "use strict";

        let kthelper = new KtHelper();
        let styles = kthelper.scopeEval(scope, val);
        for (let styleName in styles) {
            if ( ! styles.hasOwnProperty(styleName))
                continue;
            if (styles[styleName] === null) {
                elem.style.removeProperty(styleName);
            } else {
                elem.style.setProperty(styleName, styles[styleName]);
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
        saveScope.$scope = $scope;

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
                    this.render(this.$scope);
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
                if (typeof target[key] === "object" && target[key] !== null)
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
        if (typeof $scope === "undefined")
            $scope = this.$scope;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9IF9fc2NvcGVcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlXG4gICAgICogQHJldHVybiB7YW55fVxuICAgICAqL1xuICAgIGtldmFsKHN0bXQsIF9fc2NvcGUsIGUpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gX19zY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gX19zY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBzY29wZSB3YXMgY2xvbmVkLCB0aGUgb3JpZ2luYWwgd2lsbCBiZSBpbiAkc2NvcGUuIFRoaXMgaXMgaW1wb3J0YW50IHdoZW5cbiAgICAgICAgLy8gVXNpbmcgZXZlbnRzIFtvbi5jbGlja10sIGUuZy5cbiAgICAgICAgaWYgKHR5cGVvZiBfX3Njb3BlLiRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgciArPSBcInZhciAkc2NvcGUgPSBfX3Njb3BlO1wiO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChyICsgc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJzogXCIgKyBleCArIFwiIG9uIGVsZW1lbnQgXCIsIGUub3V0ZXJIVE1MLCBcIihjb250ZXh0OlwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICB2YXIgX192YWwgPSBudWxsO1xuICAgICAgICBsZXQgcyA9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIC8vY29uc29sZS5sb2cocik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBldmFsKHIgKyBzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgc2NvcGVFdmFsKCcke3J9JHtzfScpIGZhaWxlZDogJHtlfWApO1xuICAgICAgICAgICAgdGhyb3cgYGV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX1gO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfX3ZhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiAgRmluZCB0aGUgZmlyc3Qgd2hpdGVzcGFjZXMgaW4gdGV4dCBhbmQgcmVtb3ZlIHRoZW0gZnJvbSB0aGVcbiAgICAgKiAgc3RhcnQgb2YgdGhlIGZvbGxvd2luZyBsaW5lcy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge3N0cmluZ30gc3RyXG4gICAgICogIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1bmluZGVudFRleHQoc3RyKSB7XG4gICAgICAgIGxldCBpID0gc3RyLm1hdGNoKC9cXG4oXFxzKikvbSlbMV07XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoYFxcbiR7aX1gLCBcImdcIiksIFwiXFxuXCIpO1xuICAgICAgICBzdHIgPSBzdHIudHJpbSgpO1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuXG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IFsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIjXCIgKyB0aGlzLmlkICsgXCJbXCIgKyB0aGlzLl9rdElkICsgXCJdOlwiXTtcblxuICAgICAgICBmb3IgKGxldCBlIG9mIGFyZ3VtZW50cylcbiAgICAgICAgICAgIGEucHVzaChlKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWxrIHRocm91Z2ggYWxsIGVsZW1lbnRzIGFuZCB0cnkgdG8gcmVuZGVyIHRoZW0uXG4gICAgICpcbiAgICAgKiBpZiBhIGVsZW1lbnQgaGFzIHRoZSBfa2FNYiAobWFpbnRhaW5lZCBieSkgcHJvcGVydHkgc2V0LFxuICAgICAqIGNoZWNrIGlmIGl0IGVxdWFscyB0aGlzLl9rYUlkICh0aGUgZWxlbWVudCBpZCkuIElmIG5vdCxcbiAgICAgKiBza2lwIHRoaXMgbm9kZS5cbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgJHNjb3BlKSB7XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwiX2thTWJcIikgJiYgbm9kZS5fa2FNYiAhPT0gdGhpcy5fa3RJZClcbiAgICAgICAgICAgIHJldHVybjtcblxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoJHNjb3BlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZU5vZGVzKCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgZWwuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnRFbGVtZW50ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZSBhbmQgYXBwZW5kIGFsbCBlbGVtZW50cyBpblxuICAgICAqIGNvbnRlbnQgb2YgdGVtcGxhdGUgdG8gdGhlIG5leHQgc2libGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBzaWJsaW5nXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIF9hcHBlbmRFbGVtZW50c1RvUGFyZW50KHNpYmxpbmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzaWJsaW5nID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgbGV0IGNuID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgICAgIGZvciAobGV0IGNlbCBvZiBjbi5jaGlsZHJlbikge1xuICAgICAgICAgICAgY2VsLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS50YWdOYW1lID09PSBcIlNDUklQVFwiKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBEb24ndCBwYXJzZSBiZXdlZW4gPHNjcmlwdD48L3NjcmlwdD4gdGFnc1xuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImthLWxvb3BcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuICAgICAgICAgICAgbGV0IG1hID0gYXR0ci5tYXRjaCgvbGV0XFxzKyhcXFMqKVxccysoaW58b2Z8cmVwZWF0KVxccysoXFxTKikoXFxzK2luZGV4YnlcXHMrKFxcUyopKT8vKTtcbiAgICAgICAgICAgIGlmIChtYSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9ybW9kZVwiLCBtYVsyXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgbWFbM10pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZGF0YVwiLCBtYVsxXSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYVs1XSAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JpZHhcIiwgbWFbNV0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JldmFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZXZhbFwiLCBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JldmFsXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IFwiQ2Fubm90IHBhcnNlICpmb3I9J1wiICsgYXR0ciArIFwiJyBmb3IgZWxlbWVudCBcIiArIG5vZGUub3V0ZXJIVE1MO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGt0Q2xhc3NlcyA9IG51bGw7XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuICAgICAgICBsZXQgZXZlbnRzID0ge307XG4gICAgICAgIGxldCBzdHlsZXMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXRbMV0gPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrdENsYXNzZXMgPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwib25cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c1tzcGxpdFsxXV0gPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3R5bGVcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCB8fCBrdENsYXNzZXMgIT09IG51bGwgfHwgT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwIHx8IHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cblxuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChzdHlsZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtc3R5bGVzXCIsIFwie1wiICsgc3R5bGVzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoa3RDbGFzc2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jbHVkZSBbY2xhc3NsaXN0Ll09XCJ7Y2xhc3M6IGNvbmR9XCJcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBrdENsYXNzZXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LW9uXCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50cykpO1xuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3Qtc3R5bGVzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBzdHlsZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IHN0eWxlTmFtZSBpbiBzdHlsZXMpIHtcbiAgICAgICAgICAgIGlmICggISBzdHlsZXMuaGFzT3duUHJvcGVydHkoc3R5bGVOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNbc3R5bGVOYW1lXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUucmVtb3ZlUHJvcGVydHkoc3R5bGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5zZXRQcm9wZXJ0eShzdHlsZU5hbWUsIHN0eWxlc1tzdHlsZU5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG4gICAgICAgIHNhdmVTY29wZS4kc2NvcGUgPSAkc2NvcGU7XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8IHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMub3V0ZXJIVE1MKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIGZvcihuIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7fTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9sb2coXCJjb25uZWN0ZWRDYWxsYmFjaygpXCIsIHRoaXMpO1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKVxuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbG9nKFwiYXV0b3N0YXJ0OiBfaW5pdCgpXCIsIFwiZG9jdW1lbnQucmVhZHlTdGF0ZTogXCIsIGRvY3VtZW50LnJlYWR5U3RhdGUpO1xuXG4gICAgICAgICAgICBsZXQgaW5pdCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG8gPT09IFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGV2YWwoYXV0byk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHNjb3BlIGFuZCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiBrYV90cGwoXCJ0cGwwMVwiKS4kc2NvcGUgPSB7bmFtZTogXCJib2JcIn07XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdmFsXG4gICAgICovXG4gICAgc2V0ICRzY29wZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB2YWw7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9ubHkgaWYgZG9tIGF2YWlsYWJsZSAoYWxsb3cgPHNjcmlwdD4gaW5zaWRlIHRlbXBsYXRlIHRvIHNldCBzY29wZSBiZWZvcmUgZmlyc3QgcmVuZGVyaW5nXG4gICAgICAgIGlmICggISB0aGlzLl9pc0luaXRpYWxpemluZylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICB9XG5cbiAgICBnZXQgJHNjb3BlKCkge1xuICAgICAgICBsZXQgaGFuZGxlciA9IHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cgKFwic2V0OlwiLCB0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIC8vIERvbid0IHVwZGF0ZSBwcm94eSBkdXJpbmcgcmVuZGVyaW5nIChyZWN1cnNpb24pXG4gICAgICAgICAgICAgICAgaWYgKCAhIHRoaXMuX2lzUmVuZGVyaW5nKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0OiAodGFyZ2V0LCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiICYmIHRhcmdldFtrZXldICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG5cblxuICAgIF9pbml0KCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGxvYWRlciBlbGVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcuaGFzQXR0cmlidXRlKFwia2EtbG9hZGVyXCIpKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAkc2NvcGUgPSB0aGlzLiRzY29wZTtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLYVZhbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdEhscHIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImFmdGVycmVuZGVyXCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih7fSk7XG4gICAgfVxuICAgIF9sb2coKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKGByZW5kZXIoYCwgJHNjb3BlLCBgKSBvbiAnJHt0aGlzLm91dGVySFRNTH0nYCk7XG4gICAgICAgIHRyeSB7XG5cbiAgICAgICAgICAgIGxldCB2ID0gdGhpcy5fa3RIbHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHJzLnN0bXQpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwidW5pbmRlbnRcIikpIHtcbiAgICAgICAgICAgICAgICB2ID0gdGhpcy5fa3RIbHByLnVuaW5kZW50VGV4dCh2KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiaHRtbFwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0gdjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSB2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmFmdGVycmVuZGVyICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIGV2YWwodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRoaXMuaW5uZXJUZXh0ID0gZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtdmFsXCIsIEthVmFsKTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG5cbiAgICAgICAgaWYgKCAhIGlzVHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGxldCBhdHRyTmFtZSBpbiBLVF9GTikge1xuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksICRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCAkc2NvcGUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3RIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxS0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMxRkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3ZHQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDbkhBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1SEE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDOURBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUMvQkE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBIiwiZmlsZSI6Imthc2ltaXItdHBsLmpzIiwic291cmNlc0NvbnRlbnQiOlsiXG5jbGFzcyBLdEhlbHBlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHN0bXRcbiAgICAgKiBAcGFyYW0ge2NvbnRleHR9IF9fc2NvcGVcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlXG4gICAgICogQHJldHVybiB7YW55fVxuICAgICAqL1xuICAgIGtldmFsKHN0bXQsIF9fc2NvcGUsIGUpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gX19zY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gX19zY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBzY29wZSB3YXMgY2xvbmVkLCB0aGUgb3JpZ2luYWwgd2lsbCBiZSBpbiAkc2NvcGUuIFRoaXMgaXMgaW1wb3J0YW50IHdoZW5cbiAgICAgICAgLy8gVXNpbmcgZXZlbnRzIFtvbi5jbGlja10sIGUuZy5cbiAgICAgICAgaWYgKHR5cGVvZiBfX3Njb3BlLiRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgciArPSBcInZhciAkc2NvcGUgPSBfX3Njb3BlO1wiO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChyICsgc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJzogXCIgKyBleCArIFwiIG9uIGVsZW1lbnQgXCIsIGUub3V0ZXJIVE1MLCBcIihjb250ZXh0OlwiLCAkc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICB2YXIgX192YWwgPSBudWxsO1xuICAgICAgICBsZXQgcyA9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIC8vY29uc29sZS5sb2cocik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBldmFsKHIgKyBzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgc2NvcGVFdmFsKCcke3J9JHtzfScpIGZhaWxlZDogJHtlfWApO1xuICAgICAgICAgICAgdGhyb3cgYGV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX1gO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiBfX3ZhbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiAgRmluZCB0aGUgZmlyc3Qgd2hpdGVzcGFjZXMgaW4gdGV4dCBhbmQgcmVtb3ZlIHRoZW0gZnJvbSB0aGVcbiAgICAgKiAgc3RhcnQgb2YgdGhlIGZvbGxvd2luZyBsaW5lcy5cbiAgICAgKlxuICAgICAqICBAcGFyYW0ge3N0cmluZ30gc3RyXG4gICAgICogIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKi9cbiAgICB1bmluZGVudFRleHQoc3RyKSB7XG4gICAgICAgIGxldCBpID0gc3RyLm1hdGNoKC9cXG4oXFxzKikvbSlbMV07XG4gICAgICAgIHN0ciA9IHN0ci5yZXBsYWNlKG5ldyBSZWdFeHAoYFxcbiR7aX1gLCBcImdcIiksIFwiXFxuXCIpO1xuICAgICAgICBzdHIgPSBzdHIudHJpbSgpO1xuICAgICAgICByZXR1cm4gc3RyO1xuICAgIH1cblxuXG59IiwiXG52YXIgX0tUX0VMRU1FTlRfSUQgPSAwO1xuXG5jbGFzcyBLdFJlbmRlcmFibGUgZXh0ZW5kcyBIVE1MVGVtcGxhdGVFbGVtZW50IHtcblxuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5faGxwciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBBcnJheSB3aXRoIGFsbCBvYnNlcnZlZCBlbGVtZW50cyBvZiB0aGlzIHRlbXBsYXRlXG4gICAgICAgICAqXG4gICAgICAgICAqIG51bGwgaW5kaWNhdGVzLCB0aGUgdGVtcGxhdGUgd2FzIG5vdCB5ZXQgcmVuZGVyZWRcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0hUTUxFbGVtZW50W119XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2VscyA9IG51bGw7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1wiZGVidWdcIjogZmFsc2V9O1xuXG4gICAgICAgIC8qKlxuICAgICAgICAgKiBUaGUgaW50ZXJuYWwgZWxlbWVudCBpZCB0byBpZGVudGlmeSB3aGljaCBlbGVtZW50c1xuICAgICAgICAgKiB0byByZW5kZXIuXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtudW1iZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SWQgPSArK19LVF9FTEVNRU5UX0lEO1xuICAgIH1cblxuICAgIGF0dHJpYnV0ZUNoYW5nZWRDYWxsYmFjayhhdHRyTmFtZSwgb2xkVmFsLCBuZXdWYWwpIHtcbiAgICAgICAgdGhpcy5fYXR0cnNbYXR0ck5hbWVdID0gbmV3VmFsO1xuICAgIH1cblxuICAgIF9sb2codjEsIHYyLCB2Mykge1xuICAgICAgICBsZXQgYSA9IFsgdGhpcy5jb25zdHJ1Y3Rvci5uYW1lICsgXCIjXCIgKyB0aGlzLmlkICsgXCJbXCIgKyB0aGlzLl9rdElkICsgXCJdOlwiXTtcblxuICAgICAgICBmb3IgKGxldCBlIG9mIGFyZ3VtZW50cylcbiAgICAgICAgICAgIGEucHVzaChlKTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZGVidWcgIT09IGZhbHNlKVxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYSk7XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBXYWxrIHRocm91Z2ggYWxsIGVsZW1lbnRzIGFuZCB0cnkgdG8gcmVuZGVyIHRoZW0uXG4gICAgICpcbiAgICAgKiBpZiBhIGVsZW1lbnQgaGFzIHRoZSBfa2FNYiAobWFpbnRhaW5lZCBieSkgcHJvcGVydHkgc2V0LFxuICAgICAqIGNoZWNrIGlmIGl0IGVxdWFscyB0aGlzLl9rYUlkICh0aGUgZWxlbWVudCBpZCkuIElmIG5vdCxcbiAgICAgKiBza2lwIHRoaXMgbm9kZS5cbiAgICAgKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqIEBwYXJhbSB7b2JqZWN0fSAkc2NvcGVcbiAgICAgKi9cbiAgICByZW5kZXJSZWN1cnNpdmUobm9kZSwgJHNjb3BlKSB7XG4gICAgICAgIGlmIChub2RlLmhhc093blByb3BlcnR5KFwiX2thTWJcIikgJiYgbm9kZS5fa2FNYiAhPT0gdGhpcy5fa3RJZClcbiAgICAgICAgICAgIHJldHVybjtcblxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoJHNjb3BlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZU5vZGVzKCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgZWwuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnRFbGVtZW50ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZSBhbmQgYXBwZW5kIGFsbCBlbGVtZW50cyBpblxuICAgICAqIGNvbnRlbnQgb2YgdGVtcGxhdGUgdG8gdGhlIG5leHQgc2libGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBzaWJsaW5nXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIF9hcHBlbmRFbGVtZW50c1RvUGFyZW50KHNpYmxpbmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzaWJsaW5nID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgbGV0IGNuID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgICAgIGZvciAobGV0IGNlbCBvZiBjbi5jaGlsZHJlbikge1xuICAgICAgICAgICAgY2VsLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS50YWdOYW1lID09PSBcIlNDUklQVFwiKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBEb24ndCBwYXJzZSBiZXdlZW4gPHNjcmlwdD48L3NjcmlwdD4gdGFnc1xuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImthLWxvb3BcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuICAgICAgICAgICAgbGV0IG1hID0gYXR0ci5tYXRjaCgvbGV0XFxzKyhcXFMqKVxccysoaW58b2Z8cmVwZWF0KVxccysoXFxTKikoXFxzK2luZGV4YnlcXHMrKFxcUyopKT8vKTtcbiAgICAgICAgICAgIGlmIChtYSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9ybW9kZVwiLCBtYVsyXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgbWFbM10pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZGF0YVwiLCBtYVsxXSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYVs1XSAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JpZHhcIiwgbWFbNV0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JldmFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZXZhbFwiLCBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JldmFsXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IFwiQ2Fubm90IHBhcnNlICpmb3I9J1wiICsgYXR0ciArIFwiJyBmb3IgZWxlbWVudCBcIiArIG5vZGUub3V0ZXJIVE1MO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGt0Q2xhc3NlcyA9IG51bGw7XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuICAgICAgICBsZXQgZXZlbnRzID0ge307XG4gICAgICAgIGxldCBzdHlsZXMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXRbMV0gPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrdENsYXNzZXMgPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwib25cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c1tzcGxpdFsxXV0gPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3R5bGVcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCB8fCBrdENsYXNzZXMgIT09IG51bGwgfHwgT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwIHx8IHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cblxuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChzdHlsZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtc3R5bGVzXCIsIFwie1wiICsgc3R5bGVzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoa3RDbGFzc2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jbHVkZSBbY2xhc3NsaXN0Ll09XCJ7Y2xhc3M6IGNvbmR9XCJcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBrdENsYXNzZXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LW9uXCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50cykpO1xuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3Qtc3R5bGVzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBzdHlsZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IHN0eWxlTmFtZSBpbiBzdHlsZXMpIHtcbiAgICAgICAgICAgIGlmICggISBzdHlsZXMuaGFzT3duUHJvcGVydHkoc3R5bGVOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNbc3R5bGVOYW1lXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUucmVtb3ZlUHJvcGVydHkoc3R5bGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5zZXRQcm9wZXJ0eShzdHlsZU5hbWUsIHN0eWxlc1tzdHlsZU5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG4gICAgICAgIHNhdmVTY29wZS4kc2NvcGUgPSAkc2NvcGU7XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwpO1xuXG4gICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsZWN0LCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMub3V0ZXJIVE1MLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgIH1cblxuICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8IHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMub3V0ZXJIVE1MKTtcbiAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcy5vdXRlckhUTUwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIGZvcihuIGluIHNlbCkge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yIHR5cGUgJ1wiICsgdGhpcy5fYXR0cnMuZm9ybW9kZSArIFwiJyBpbiBcIiAuIHRoaXMub3V0ZXJIVE1MO1xuICAgICAgICB9XG5cblxuICAgICAgICBmb3IgKGxldCBpZHggPSBuOyBzZWwubGVuZ3RoIDwgdGhpcy5fZWxzLmxlbmd0aDsgaWR4KyspIHtcbiAgICAgICAgICAgIGxldCBlbGVtID0gdGhpcy5fZWxzLnBvcCgpO1xuICAgICAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBlbGVtLm5vZGUpIHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIGN1ck5vZGUuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgICAgIGN1ck5vZGUuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGN1ck5vZGUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1sb29wXCIsIEthTG9vcCwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsInZhciBLQVNFTEYgPSBudWxsO1xuXG5jbGFzcyBLYVRwbCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9O1xuXG4gICAgICAgIC8vIFN3aXRjaGVkIHRvIHRvIGR1cmluZyBfaW5pdCgpIHRvIGFsbG93IDxzY3JpcHQ+IHRvIHNldCBzY29wZSB3aXRob3V0IHJlbmRlcmluZy5cbiAgICAgICAgdGhpcy5faXNJbml0aWFsaXppbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5faXNSZW5kZXJpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7fTtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9sb2coXCJjb25uZWN0ZWRDYWxsYmFjaygpXCIsIHRoaXMpO1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKVxuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fbG9nKFwiYXV0b3N0YXJ0OiBfaW5pdCgpXCIsIFwiZG9jdW1lbnQucmVhZHlTdGF0ZTogXCIsIGRvY3VtZW50LnJlYWR5U3RhdGUpO1xuXG4gICAgICAgICAgICBsZXQgaW5pdCA9ICgpID0+IHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgICAgICAgICAgaWYgKGF1dG8gPT09IFwiXCIpXG4gICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICBlbHNlXG4gICAgICAgICAgICAgICAgICAgIGV2YWwoYXV0byk7XG4gICAgICAgICAgICB9O1xuXG4gICAgICAgICAgICBpZiAoZG9jdW1lbnQucmVhZHlTdGF0ZSA9PT0gXCJsb2FkaW5nXCIpIHtcbiAgICAgICAgICAgICAgICBkb2N1bWVudC5hZGRFdmVudExpc3RlbmVyKFwiRE9NQ29udGVudExvYWRlZFwiLCAoKSA9PiB7XG4gICAgICAgICAgICAgICAgICAgIGluaXQoKTtcbiAgICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBTZXQgdGhlIHNjb3BlIGFuZCByZW5kZXIgdGhlIHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBgYGBcbiAgICAgKiBrYV90cGwoXCJ0cGwwMVwiKS4kc2NvcGUgPSB7bmFtZTogXCJib2JcIn07XG4gICAgICogYGBgXG4gICAgICpcbiAgICAgKiBAcGFyYW0gdmFsXG4gICAgICovXG4gICAgc2V0ICRzY29wZSh2YWwpIHtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB2YWw7XG5cbiAgICAgICAgLy8gUmVuZGVyIG9ubHkgaWYgZG9tIGF2YWlsYWJsZSAoYWxsb3cgPHNjcmlwdD4gaW5zaWRlIHRlbXBsYXRlIHRvIHNldCBzY29wZSBiZWZvcmUgZmlyc3QgcmVuZGVyaW5nXG4gICAgICAgIGlmICggISB0aGlzLl9pc0luaXRpYWxpemluZylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuX3Njb3BlKTtcbiAgICB9XG5cbiAgICBnZXQgJHNjb3BlKCkge1xuICAgICAgICBsZXQgaGFuZGxlciA9IHtcbiAgICAgICAgICAgIHNldDogKHRhcmdldCwgcHJvcGVydHksIHZhbHVlLCByZWNlaXZlcikgPT4ge1xuICAgICAgICAgICAgICAgIC8vY29uc29sZS5sb2cgKFwic2V0OlwiLCB0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSk7XG4gICAgICAgICAgICAgICAgdGFyZ2V0W3Byb3BlcnR5XSA9IHZhbHVlO1xuICAgICAgICAgICAgICAgIC8vIERvbid0IHVwZGF0ZSBwcm94eSBkdXJpbmcgcmVuZGVyaW5nIChyZWN1cnNpb24pXG4gICAgICAgICAgICAgICAgaWYgKCAhIHRoaXMuX2lzUmVuZGVyaW5nKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgcmV0dXJuIHRydWU7XG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAgZ2V0OiAodGFyZ2V0LCBrZXkpID0+IHtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiICYmIHRhcmdldFtrZXldICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG5cblxuICAgIF9pbml0KCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzICE9PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IHRydWU7XG4gICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgLy8gUmVtb3ZlIGxvYWRlciBlbGVtZW50XG4gICAgICAgICAgICBpZiAodGhpcy5uZXh0RWxlbWVudFNpYmxpbmcuaGFzQXR0cmlidXRlKFwia2EtbG9hZGVyXCIpKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZCh0aGlzLm5leHRFbGVtZW50U2libGluZyk7XG4gICAgICAgIH1cbiAgICAgICAgbGV0IHNpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuICAgICAgICAobmV3IEt0VGVtcGxhdGVQYXJzZXIpLnBhcnNlUmVjdXJzaXZlKHRoaXMuY29udGVudCk7XG5cbiAgICAgICAgS0FTRUxGID0gdGhpcztcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAkc2NvcGUgPSB0aGlzLiRzY29wZTtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJjbGFzcyBLYVZhbCBleHRlbmRzIEhUTUxFbGVtZW50IHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcml2YXRlXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdEhscHIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGxcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3RtdFwiLCBcImFmdGVycmVuZGVyXCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGlmICh0aGlzLmhhc0F0dHJpYnV0ZShcImF1dG9cIikpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih7fSk7XG4gICAgfVxuICAgIF9sb2coKSB7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpIHtcblxuICAgICAgICAgICAgY29uc29sZS5sb2cuYXBwbHkodGhpcywgYXJndW1lbnRzKTtcbiAgICAgICAgfVxuXG4gICAgfVxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgdGhpcy5fbG9nKGByZW5kZXIoYCwgJHNjb3BlLCBgKSBvbiAnJHt0aGlzLm91dGVySFRNTH0nYCk7XG4gICAgICAgIHRyeSB7XG5cbiAgICAgICAgICAgIGxldCB2ID0gdGhpcy5fa3RIbHByLnNjb3BlRXZhbCgkc2NvcGUsIHRoaXMuX2F0dHJzLnN0bXQpO1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB2ID09PSBcIm9iamVjdFwiKVxuICAgICAgICAgICAgICAgIHYgPSBKU09OLnN0cmluZ2lmeSh2KTtcblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwidW5pbmRlbnRcIikpIHtcbiAgICAgICAgICAgICAgICB2ID0gdGhpcy5fa3RIbHByLnVuaW5kZW50VGV4dCh2KTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiaHRtbFwiKSkge1xuICAgICAgICAgICAgICAgIHRoaXMuaW5uZXJIVE1MID0gdjtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSB2O1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmFmdGVycmVuZGVyICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIGV2YWwodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIpXG4gICAgICAgIH0gY2F0Y2ggKGUpIHtcbiAgICAgICAgICAgIHRoaXMuaW5uZXJUZXh0ID0gZTtcbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtdmFsXCIsIEthVmFsKTsiLCJcblxuXG5jbGFzcyBLdElmIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCJdO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgbGV0IGlzVHJ1ZSA9IHRoaXMuX2hscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG5cbiAgICAgICAgaWYgKCAhIGlzVHJ1ZSkge1xuICAgICAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1pZlwiLCBLdElmLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwiXG5cblxuY2xhc3MgS3RNYWludGFpbiBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fcmVtb3ZlTm9kZXMoKTtcbiAgICB9XG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKVxuICAgICAgICB9XG5cbiAgICAgICAgZm9yIChsZXQgY3VyRWxlbWVudCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICggdHlwZW9mIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlICE9PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBmb3IgKGxldCBhdHRyTmFtZSBpbiBLVF9GTikge1xuICAgICAgICAgICAgICAgIGlmICggISBjdXJFbGVtZW50Lmhhc0F0dHJpYnV0ZShhdHRyTmFtZSkpXG4gICAgICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgICAgIEtUX0ZOW2F0dHJOYW1lXShjdXJFbGVtZW50LCBjdXJFbGVtZW50LmdldEF0dHJpYnV0ZShhdHRyTmFtZSksICRzY29wZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJFbGVtZW50LCAkc2NvcGUsIHRydWUpO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrdC1tYWludGFpblwiLCBLdE1haW50YWluLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7Il19