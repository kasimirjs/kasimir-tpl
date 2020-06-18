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
    keval(stmt, __scope, e, __refs) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false", "await"];
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
            console.error("cannot eval() stmt: '" + stmt + "': " + ex + " on element ", e, "(context:", __scope, ")");
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
    scopeEval($scope, selector, elem) {
        const reserved = ["var", "null", "let", "const", "function", "class", "in", "of", "for", "true", "false", "await"];
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
            console.error(`scopeEval('${s}') failed: ${e} on`, elem);
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

        let refPromise = null;

        // Register references
        if (node instanceof HTMLElement && node.hasAttribute("*ref")) {
            let refname = node.getAttribute("*ref");
            refPromise = $scope.$ref[refname];
            $scope.$ref[refname] = node;
        }

        // Register id of cloned node
        if (node instanceof HTMLElement && node.hasAttribute("*id")) {
            node.id = node.getAttribute("*id");
        }

        if (typeof node.render === "function") {
            node.render($scope);
            return;
        }

        for(let curNode of node.childNodes) {
            if (node.ktSkipRender === true)
                return;
            this.renderRecursive(curNode, $scope);
        }

        if (refPromise !== null && typeof refPromise.resolve === "function") {
            // Resolve promise registered with waitRef()
            refPromise.resolve(node);
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

        // If runs after *for (to filter for values)
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
        //saveScope.$ref = $scope.$ref;

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
        let sel = this._hlpr.scopeEval($scope, _a_sel, this);

        if (this._attrs.formode !== "repeat") {

            if (typeof sel !== "object") {
                console.warn(`Invalid forSelect="${_a_sel}" returned:`, sel, "on context", context, "(Element: ", this, ")");
                throw "Invalid forSelect selector. see waring."
            }

            if (sel === null || (typeof sel[Symbol.iterator] !== "function" && typeof sel !== 'object') ) {
                this._log(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this);
                console.warn(`Selector '${_a_sel}' in for statement is not iterable. Returned value: `, sel, "in", this)
                return;
            }
        } else {
            if (typeof sel !== "number") {
                this._log(`Selector '${_a_sel}' in for statement is a number. Returned value: `, sel, "in", this);
                console.warn(`Selector '${_a_sel}' in for statement is a number. Returned value: `, sel, "in", this)
                return;
            }
        }

        if (this._origSibling === false)
            this._origSibling = this.nextSibling;


        let n = 0;
        switch (this._attrs.formode) {
            case "in":
                n = 0;
                for(let i in sel) {
                    $scope[this._attrs.fordata] = i;
                    this._maintainNode(n, $scope);
                    n++;
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
            "afterrender": null,
            "nodebounce": false
        };

        // Switched to to during _init() to allow <script> to set scope without rendering.
        this._isInitializing = false;
        this._isRendering = false;
        this._refs = {};
        this._scope = {"$ref":this._refs};
        this.__debounceTimeout = null;
        this._handler = {};
    }

    /**
     * Refer to the current template (should be used by <script> inside a template to reference the
     * current template
     *
     * @type {KaTpl}
     */
    static get self() {
        return KaTpl.prototype.self;
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
        this._scope.$ref = this._refs;

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
                if ( ! this._isRendering) {
                    if (this._attrs.nodebounce === false) {
                        // Default behaviour: Debounce: So you can do multiple $scope updated with rending only once
                        if (this.__debounceTimeout !== null) {
                            window.clearTimeout(this.__debounceTimeout);
                            this.__debounceTimeout = null;
                        }
                        this.__debounceTimeout = window.setTimeout(() => {
                            this.render(this.$scope);
                        }, 10);
                    } else {
                        this.render(this.$scope);
                    }

                }
                return true;
            },
            get: (target, key) => {
                if (key === "$ref") {

                    return this._refs;
                }
                if (typeof target[key] === "object" && target[key] !== null)
                    return new Proxy(target[key], handler);
                return target[key];
            }

        };
        return new Proxy(this._scope, handler);
    }

    /**
     * Execute custom functions from outside the template
     *
     * <example>
     *     ka_tpl("tpl1").$fn.doSomething();
     * </example>
     *
     * @return {{customFn: (function(*): string)}|{}}
     */
    get $fn () {
        return this.$scope.$fn;
    }

    /**
     * Initialize the scope. Will return the proxied scope object.
     *
     * The proxy keeps track about changes to $scope and rerenders the
     * data then.
     *
     * So you can use the return value within the scope definition itself.
     *
     * <example>
     * let $scope = KaTpl.self.scopeInit({
     *     someData: [],
     *
     *     $fn: {
     *         update: () => {
     *             $scope.someData.push("Item")
     *         }
     *     }
     * });
     * </example>
     *
     * @param {{$fn:{}}} $scope
     * @return {Proxy<{}>}
     */
    scopeInit($scope) {
        this.$scope = $scope;
        return this.$scope; // <- Query scope over getter to receive proxy
    }


    /**
     * Wait for a reference to be rendered
     *
     * Returns a promise that is resolved once the Referenced
     * Element (containing *ref attribute) in template and all its
     * child elements was rendered.
     *
     * If the element
     *
     * <example>
     *     <script>
     *          (async(self) =>  {

                    let input = await self.waitRef("input1");
                    console.log (input );
                })(KaTpl.self);
     *     </script>
     *     let elem = await self.waitRef("input1")
     * </example>
     *
     * @param name
     * @return {Promise}
     */
    waitRef(name) {
        if (typeof this.$scope.$ref[name] === "undefined") {
            var resolver;
            let p = new Promise(resolve => {
                resolver = resolve
            });
            p.resolve = function (value) {
                resolver(value);
            }
            this.$scope.$ref[name] = p;
            return p;
        }
        // Return immediate if reference already existing
        return Promise.resolve(this.$scope.$ref[name]);
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

        // Register self reference (see: KaTpl.self)
        KASELF = this;
        KaTpl.prototype.self = this;

        if (this._els === null) {
            this._appendElementsToParent();

        }

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJrYXNpbWlyLXRwbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuY2xhc3MgS3RIZWxwZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdG10XG4gICAgICogQHBhcmFtIHtjb250ZXh0fSBfX3Njb3BlXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZVxuICAgICAqIEByZXR1cm4ge2FueX1cbiAgICAgKi9cbiAgICBrZXZhbChzdG10LCBfX3Njb3BlLCBlLCBfX3JlZnMpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiLCBcImF3YWl0XCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiBfX3Njb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSBfX3Njb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgdGhlIHNjb3BlIHdhcyBjbG9uZWQsIHRoZSBvcmlnaW5hbCB3aWxsIGJlIGluICRzY29wZS4gVGhpcyBpcyBpbXBvcnRhbnQgd2hlblxuICAgICAgICAvLyBVc2luZyBldmVudHMgW29uLmNsaWNrXSwgZS5nLlxuICAgICAgICBpZiAodHlwZW9mIF9fc2NvcGUuJHNjb3BlID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByICs9IFwidmFyICRzY29wZSA9IF9fc2NvcGU7XCI7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJzogXCIgKyBleCArIFwiIG9uIGVsZW1lbnQgXCIsIGUsIFwiKGNvbnRleHQ6XCIsIF9fc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IsIGVsZW0pIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiLCBcImF3YWl0XCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX0gb25gLCBlbGVtKTtcbiAgICAgICAgICAgIHRocm93IGBldmFsKCcke3N9JykgZmFpbGVkOiAke2V9YDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEZpbmQgdGhlIGZpcnN0IHdoaXRlc3BhY2VzIGluIHRleHQgYW5kIHJlbW92ZSB0aGVtIGZyb20gdGhlXG4gICAgICogIHN0YXJ0IG9mIHRoZSBmb2xsb3dpbmcgbGluZXMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtzdHJpbmd9IHN0clxuICAgICAqICBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgdW5pbmRlbnRUZXh0KHN0cikge1xuICAgICAgICBsZXQgaSA9IHN0ci5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZShuZXcgUmVnRXhwKGBcXG4ke2l9YCwgXCJnXCIpLCBcIlxcblwiKTtcbiAgICAgICAgc3RyID0gc3RyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cblxufSIsIlxudmFyIF9LVF9FTEVNRU5UX0lEID0gMDtcblxuY2xhc3MgS3RSZW5kZXJhYmxlIGV4dGVuZHMgSFRNTFRlbXBsYXRlRWxlbWVudCB7XG5cblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2hscHIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgd2l0aCBhbGwgb2JzZXJ2ZWQgZWxlbWVudHMgb2YgdGhpcyB0ZW1wbGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBudWxsIGluZGljYXRlcywgdGhlIHRlbXBsYXRlIHdhcyBub3QgeWV0IHJlbmRlcmVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtIVE1MRWxlbWVudFtdfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcImRlYnVnXCI6IGZhbHNlfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGludGVybmFsIGVsZW1lbnQgaWQgdG8gaWRlbnRpZnkgd2hpY2ggZWxlbWVudHNcbiAgICAgICAgICogdG8gcmVuZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdElkID0gKytfS1RfRUxFTUVOVF9JRDtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBfbG9nKHYxLCB2MiwgdjMpIHtcbiAgICAgICAgbGV0IGEgPSBbIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiI1wiICsgdGhpcy5pZCArIFwiW1wiICsgdGhpcy5fa3RJZCArIFwiXTpcIl07XG5cbiAgICAgICAgZm9yIChsZXQgZSBvZiBhcmd1bWVudHMpXG4gICAgICAgICAgICBhLnB1c2goZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KHRoaXMsIGEpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogV2FsayB0aHJvdWdoIGFsbCBlbGVtZW50cyBhbmQgdHJ5IHRvIHJlbmRlciB0aGVtLlxuICAgICAqXG4gICAgICogaWYgYSBlbGVtZW50IGhhcyB0aGUgX2thTWIgKG1haW50YWluZWQgYnkpIHByb3BlcnR5IHNldCxcbiAgICAgKiBjaGVjayBpZiBpdCBlcXVhbHMgdGhpcy5fa2FJZCAodGhlIGVsZW1lbnQgaWQpLiBJZiBub3QsXG4gICAgICogc2tpcCB0aGlzIG5vZGUuXG4gICAgICpcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsICRzY29wZSkge1xuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcIl9rYU1iXCIpICYmIG5vZGUuX2thTWIgIT09IHRoaXMuX2t0SWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbGV0IHJlZlByb21pc2UgPSBudWxsO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBub2RlLmhhc0F0dHJpYnV0ZShcIipyZWZcIikpIHtcbiAgICAgICAgICAgIGxldCByZWZuYW1lID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqcmVmXCIpO1xuICAgICAgICAgICAgcmVmUHJvbWlzZSA9ICRzY29wZS4kcmVmW3JlZm5hbWVdO1xuICAgICAgICAgICAgJHNjb3BlLiRyZWZbcmVmbmFtZV0gPSBub2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgaWQgb2YgY2xvbmVkIG5vZGVcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBub2RlLmhhc0F0dHJpYnV0ZShcIippZFwiKSkge1xuICAgICAgICAgICAgbm9kZS5pZCA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVmUHJvbWlzZSAhPT0gbnVsbCAmJiB0eXBlb2YgcmVmUHJvbWlzZS5yZXNvbHZlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIC8vIFJlc29sdmUgcHJvbWlzZSByZWdpc3RlcmVkIHdpdGggd2FpdFJlZigpXG4gICAgICAgICAgICByZWZQcm9taXNlLnJlc29sdmUobm9kZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgcnVucyBhZnRlciAqZm9yICh0byBmaWx0ZXIgZm9yIHZhbHVlcylcbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQga3RDbGFzc2VzID0gbnVsbDtcbiAgICAgICAgbGV0IGF0dHJzID0gW107XG4gICAgICAgIGxldCBldmVudHMgPSB7fTtcbiAgICAgICAgbGV0IHN0eWxlcyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGxpdFsxXSA9PT0gXCJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGt0Q2xhc3NlcyA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzQ2xhc3Nlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvblwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzW3NwbGl0WzFdXSA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzdHlsZVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwIHx8IGt0Q2xhc3NlcyAhPT0gbnVsbCB8fCBPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDAgfHwgc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1tYWludGFpblwifSk7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuXG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArIFwifVwiKTtcblxuICAgICAgICAgICAgaWYgKHN0eWxlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1zdHlsZXNcIiwgXCJ7XCIgKyBzdHlsZXMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChrdENsYXNzZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRlIFtjbGFzc2xpc3QuXT1cIntjbGFzczogY29uZH1cIlxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIGt0Q2xhc3Nlcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtb25cIiwgSlNPTi5zdHJpbmdpZnkoZXZlbnRzKSk7XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cblxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3Qtc3R5bGVzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBzdHlsZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IHN0eWxlTmFtZSBpbiBzdHlsZXMpIHtcbiAgICAgICAgICAgIGlmICggISBzdHlsZXMuaGFzT3duUHJvcGVydHkoc3R5bGVOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNbc3R5bGVOYW1lXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUucmVtb3ZlUHJvcGVydHkoc3R5bGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5zZXRQcm9wZXJ0eShzdHlsZU5hbWUsIHN0eWxlc1tzdHlsZU5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG4gICAgICAgIHNhdmVTY29wZS4kc2NvcGUgPSAkc2NvcGU7XG4gICAgICAgIC8vc2F2ZVNjb3BlLiRyZWYgPSAkc2NvcGUuJHJlZjtcblxuICAgICAgICBsZXQgZXZlbnRzID0gSlNPTi5wYXJzZSh2YWwpO1xuICAgICAgICBmb3IgKGxldCBldmVudCBpbiBldmVudHMpIHtcbiAgICAgICAgICAgIGVsZW1bXCJvblwiICsgZXZlbnRdID0gKGUpID0+IHtcbiAgICAgICAgICAgICAgICBrdGhlbHBlci5rZXZhbChldmVudHNbZXZlbnRdLCBzYXZlU2NvcGUsIGVsZW0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfVxufTsiLCJcblxuY2xhc3MgS2FJbmNsdWRlIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYXV0b1wiOiBudWxsLFxuICAgICAgICAgICAgXCJyYXdcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3JjXCIsIFwiZGVidWdcIiwgXCJhdXRvXCIsIFwicmF3XCJdO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogPHNjcmlwdD4gdGFncyB0aGF0IHdlcmUgbG9hZGVkIHZpYSBhamF4IHdvbid0IGJlIGV4ZWN1dGVkXG4gICAgICogd2hlbiBhZGRlZCB0byBkb20uXG4gICAgICpcbiAgICAgKiBUaGVyZWZvcmUgd2UgaGF2ZSB0byByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGRvZXMgdGhpc1xuICAgICAqIGF1dG9tYXRpY2FsbHkgYm90aCBmb3Igbm9ybWFsIGFuZCBmb3IgdGVtcGxhdGUgKGNvbnRlbnQpIG5vZGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbXBvcnRTY3JpdHBSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICBsZXQgY2hlbHMgPSBub2RlIGluc3RhbmNlb2YgSFRNTFRlbXBsYXRlRWxlbWVudCA/IG5vZGUuY29udGVudC5jaGlsZE5vZGVzIDogbm9kZS5jaGlsZE5vZGVzO1xuXG4gICAgICAgIGZvciAobGV0IHMgb2YgY2hlbHMpIHtcbiAgICAgICAgICAgIGlmIChzLnRhZ05hbWUgIT09IFwiU0NSSVBUXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUocyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICBuLmlubmVySFRNTCA9IHMuaW5uZXJIVE1MO1xuICAgICAgICAgICAgcy5yZXBsYWNlV2l0aChuKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgX2xvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMuX2F0dHJzLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMucmF3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vZGVzIGxvYWRlZCBmcm9tIHJlbW90ZSB3b24ndCBnZXQgZXhlY3V0ZWQuIFNvIGltcG9ydCB0aGVtLlxuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2coXCJ0cmlnZ2VyIERPTUNvbnRlbnRMb2FkZWQgZXZlbnQgb25cIiwgZWwpO1xuICAgICAgICAgICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChcIkRPTUNvbnRlbnRMb2FkZWRcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcblxuICAgICAgICB4aHR0cC5zZW5kKCk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpO1xuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1pbmNsdWRlXCIsIEthSW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEthTG9vcCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcm1vZGVcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yaWR4XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmRhdGFcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJmb3JzZWxlY3RcIiwgXCJmb3JpZHhcIiwgXCJmb3JkYXRhXCIsIFwiZm9yZXZhbFwiLCBcImZvcm1vZGVcIl07XG4gICAgfVxuXG5cbiAgICBfYXBwZW5kRWxlbSgpIHtcbiAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjdXJOb2RlLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIG5vZGVzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMuX29yaWdTaWJsaW5nKTtcbiAgICAgICAgdGhpcy5fZWxzLnB1c2goe1xuICAgICAgICAgICAgbm9kZTogbm9kZXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICBfbWFpbnRhaW5Ob2RlKGksICRzY29wZSkge1xuICAgICAgICBpZiAodGhpcy5fZWxzLmxlbmd0aCA8IGkrMSlcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW0oKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmlkeCAhPT0gbnVsbClcbiAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JpZHhdID0gaTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2hscHIua2V2YWwodGhpcy5fYXR0cnMuZm9yZXZhbCwgJHNjb3BlLCB0aGlzKTtcblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2Vsc1tpXS5ub2RlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGxldCBfYV9zZWwgPSB0aGlzLl9hdHRycy5mb3JzZWxlY3Q7XG4gICAgICAgIGxldCBzZWwgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIF9hX3NlbCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcm1vZGUgIT09IFwicmVwZWF0XCIpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsLCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMsIFwiKVwiKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzZWwgPT09IG51bGwgfHwgKHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBzZWwgIT09ICdvYmplY3QnKSApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlbCAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBhIG51bWJlci4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgYSBudW1iZXIuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvcihsZXQgaSBpbiBzZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvciB0eXBlICdcIiArIHRoaXMuX2F0dHJzLmZvcm1vZGUgKyBcIicgaW4gXCIgLiB0aGlzLm91dGVySFRNTDtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gbjsgc2VsLmxlbmd0aCA8IHRoaXMuX2Vscy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICAgICAgICBsZXQgZWxlbSA9IHRoaXMuX2Vscy5wb3AoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgZWxlbS5ub2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJOb2RlLl9yZW1vdmVOb2RlcyA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgICAgICBjdXJOb2RlLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtbG9vcFwiLCBLYUxvb3AsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJ2YXIgS0FTRUxGID0gbnVsbDtcblxuY2xhc3MgS2FUcGwgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGwsXG4gICAgICAgICAgICBcIm5vZGVib3VuY2VcIjogZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTd2l0Y2hlZCB0byB0byBkdXJpbmcgX2luaXQoKSB0byBhbGxvdyA8c2NyaXB0PiB0byBzZXQgc2NvcGUgd2l0aG91dCByZW5kZXJpbmcuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3JlZnMgPSB7fTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7XCIkcmVmXCI6dGhpcy5fcmVmc307XG4gICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXIgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgKHNob3VsZCBiZSB1c2VkIGJ5IDxzY3JpcHQ+IGluc2lkZSBhIHRlbXBsYXRlIHRvIHJlZmVyZW5jZSB0aGVcbiAgICAgKiBjdXJyZW50IHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBAdHlwZSB7S2FUcGx9XG4gICAgICovXG4gICAgc3RhdGljIGdldCBzZWxmKCkge1xuICAgICAgICByZXR1cm4gS2FUcGwucHJvdG90eXBlLnNlbGY7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwiY29ubmVjdGVkQ2FsbGJhY2soKVwiLCB0aGlzKTtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIilcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhcImF1dG9zdGFydDogX2luaXQoKVwiLCBcImRvY3VtZW50LnJlYWR5U3RhdGU6IFwiLCBkb2N1bWVudC5yZWFkeVN0YXRlKTtcblxuICAgICAgICAgICAgbGV0IGluaXQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICAgICAgICAgIGlmIChhdXRvID09PSBcIlwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBldmFsKGF1dG8pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuICAgICAgICB0aGlzLl9zY29wZS4kcmVmID0gdGhpcy5fcmVmcztcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLm5vZGVib3VuY2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGJlaGF2aW91cjogRGVib3VuY2U6IFNvIHlvdSBjYW4gZG8gbXVsdGlwbGUgJHNjb3BlIHVwZGF0ZWQgd2l0aCByZW5kaW5nIG9ubHkgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX19kZWJvdW5jZVRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09IFwiJHJlZlwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIgJiYgdGFyZ2V0W2tleV0gIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIGN1c3RvbSBmdW5jdGlvbnMgZnJvbSBvdXRzaWRlIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogICAgIGthX3RwbChcInRwbDFcIikuJGZuLmRvU29tZXRoaW5nKCk7XG4gICAgICogPC9leGFtcGxlPlxuICAgICAqXG4gICAgICogQHJldHVybiB7e2N1c3RvbUZuOiAoZnVuY3Rpb24oKik6IHN0cmluZyl9fHt9fVxuICAgICAqL1xuICAgIGdldCAkZm4gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kc2NvcGUuJGZuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIHNjb3BlLiBXaWxsIHJldHVybiB0aGUgcHJveGllZCBzY29wZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBUaGUgcHJveHkga2VlcHMgdHJhY2sgYWJvdXQgY2hhbmdlcyB0byAkc2NvcGUgYW5kIHJlcmVuZGVycyB0aGVcbiAgICAgKiBkYXRhIHRoZW4uXG4gICAgICpcbiAgICAgKiBTbyB5b3UgY2FuIHVzZSB0aGUgcmV0dXJuIHZhbHVlIHdpdGhpbiB0aGUgc2NvcGUgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiBsZXQgJHNjb3BlID0gS2FUcGwuc2VsZi5zY29wZUluaXQoe1xuICAgICAqICAgICBzb21lRGF0YTogW10sXG4gICAgICpcbiAgICAgKiAgICAgJGZuOiB7XG4gICAgICogICAgICAgICB1cGRhdGU6ICgpID0+IHtcbiAgICAgKiAgICAgICAgICAgICAkc2NvcGUuc29tZURhdGEucHVzaChcIkl0ZW1cIilcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7eyRmbjp7fX19ICRzY29wZVxuICAgICAqIEByZXR1cm4ge1Byb3h5PHt9Pn1cbiAgICAgKi9cbiAgICBzY29wZUluaXQoJHNjb3BlKSB7XG4gICAgICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xuICAgICAgICByZXR1cm4gdGhpcy4kc2NvcGU7IC8vIDwtIFF1ZXJ5IHNjb3BlIG92ZXIgZ2V0dGVyIHRvIHJlY2VpdmUgcHJveHlcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhaXQgZm9yIGEgcmVmZXJlbmNlIHRvIGJlIHJlbmRlcmVkXG4gICAgICpcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGlzIHJlc29sdmVkIG9uY2UgdGhlIFJlZmVyZW5jZWRcbiAgICAgKiBFbGVtZW50IChjb250YWluaW5nICpyZWYgYXR0cmlidXRlKSBpbiB0ZW1wbGF0ZSBhbmQgYWxsIGl0c1xuICAgICAqIGNoaWxkIGVsZW1lbnRzIHdhcyByZW5kZXJlZC5cbiAgICAgKlxuICAgICAqIElmIHRoZSBlbGVtZW50XG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiAgICAgPHNjcmlwdD5cbiAgICAgKiAgICAgICAgICAoYXN5bmMoc2VsZikgPT4gIHtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgaW5wdXQgPSBhd2FpdCBzZWxmLndhaXRSZWYoXCJpbnB1dDFcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nIChpbnB1dCApO1xuICAgICAgICAgICAgICAgIH0pKEthVHBsLnNlbGYpO1xuICAgICAqICAgICA8L3NjcmlwdD5cbiAgICAgKiAgICAgbGV0IGVsZW0gPSBhd2FpdCBzZWxmLndhaXRSZWYoXCJpbnB1dDFcIilcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0gbmFtZVxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICovXG4gICAgd2FpdFJlZihuYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgdmFyIHJlc29sdmVyO1xuICAgICAgICAgICAgbGV0IHAgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlciA9IHJlc29sdmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcC5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZXIodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9IHA7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXR1cm4gaW1tZWRpYXRlIGlmIHJlZmVyZW5jZSBhbHJlYWR5IGV4aXN0aW5nXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy4kc2NvcGUuJHJlZltuYW1lXSk7XG4gICAgfVxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHNlbGYgcmVmZXJlbmNlIChzZWU6IEthVHBsLnNlbGYpXG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIEthVHBsLnByb3RvdHlwZS5zZWxmID0gdGhpcztcblxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG5cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAkc2NvcGUgPSB0aGlzLiRzY29wZTtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDcFBBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzlEQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDL0JBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQSIsImZpbGUiOiJrYXNpbWlyLXRwbC5qcyIsInNvdXJjZXNDb250ZW50IjpbIlxuY2xhc3MgS3RIZWxwZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzdG10XG4gICAgICogQHBhcmFtIHtjb250ZXh0fSBfX3Njb3BlXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZVxuICAgICAqIEByZXR1cm4ge2FueX1cbiAgICAgKi9cbiAgICBrZXZhbChzdG10LCBfX3Njb3BlLCBlLCBfX3JlZnMpIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiLCBcImF3YWl0XCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiBfX3Njb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSBfX3Njb3BlWycke19fbmFtZX0nXTtgXG4gICAgICAgIH1cbiAgICAgICAgLy8gSWYgdGhlIHNjb3BlIHdhcyBjbG9uZWQsIHRoZSBvcmlnaW5hbCB3aWxsIGJlIGluICRzY29wZS4gVGhpcyBpcyBpbXBvcnRhbnQgd2hlblxuICAgICAgICAvLyBVc2luZyBldmVudHMgW29uLmNsaWNrXSwgZS5nLlxuICAgICAgICBpZiAodHlwZW9mIF9fc2NvcGUuJHNjb3BlID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICByICs9IFwidmFyICRzY29wZSA9IF9fc2NvcGU7XCI7XG4gICAgICAgIH1cbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIHJldHVybiBldmFsKHIgKyBzdG10KVxuICAgICAgICB9IGNhdGNoIChleCkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihcImNhbm5vdCBldmFsKCkgc3RtdDogJ1wiICsgc3RtdCArIFwiJzogXCIgKyBleCArIFwiIG9uIGVsZW1lbnQgXCIsIGUsIFwiKGNvbnRleHQ6XCIsIF9fc2NvcGUsIFwiKVwiKTtcbiAgICAgICAgICAgIHRocm93IFwiZXZhbCgnXCIgKyBzdG10ICsgXCInKSBmYWlsZWQ6IFwiICsgZXg7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZXR1cm5zIGEgc3RyaW5nIHRvIGJlIGV2YWwoKSdlZCByZWdpc3RlcmluZ1xuICAgICAqIGFsbCB0aGUgdmFyaWFibGVzIGluIHNjb3BlIHRvIG1ldGhvZCBjb250ZXh0XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHNlbGVjdG9yXG4gICAgICogQHJldHVybiB7c3RyaW5nfVxuICAgICAqXG4gICAgICovXG4gICAgc2NvcGVFdmFsKCRzY29wZSwgc2VsZWN0b3IsIGVsZW0pIHtcbiAgICAgICAgY29uc3QgcmVzZXJ2ZWQgPSBbXCJ2YXJcIiwgXCJudWxsXCIsIFwibGV0XCIsIFwiY29uc3RcIiwgXCJmdW5jdGlvblwiLCBcImNsYXNzXCIsIFwiaW5cIiwgXCJvZlwiLCBcImZvclwiLCBcInRydWVcIiwgXCJmYWxzZVwiLCBcImF3YWl0XCJdO1xuICAgICAgICBsZXQgciA9IFwiXCI7XG4gICAgICAgIGZvciAobGV0IF9fbmFtZSBpbiAkc2NvcGUpIHtcbiAgICAgICAgICAgIGlmIChyZXNlcnZlZC5pbmRleE9mKF9fbmFtZSkgIT09IC0xKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgciArPSBgdmFyICR7X19uYW1lfSA9ICRzY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIHZhciBfX3ZhbCA9IG51bGw7XG4gICAgICAgIGxldCBzID0gYF9fdmFsID0gJHtzZWxlY3Rvcn07YDtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhyKTtcbiAgICAgICAgdHJ5IHtcbiAgICAgICAgICAgIGV2YWwociArIHMpO1xuICAgICAgICB9IGNhdGNoIChlKSB7XG4gICAgICAgICAgICBjb25zb2xlLmVycm9yKGBzY29wZUV2YWwoJyR7c30nKSBmYWlsZWQ6ICR7ZX0gb25gLCBlbGVtKTtcbiAgICAgICAgICAgIHRocm93IGBldmFsKCcke3N9JykgZmFpbGVkOiAke2V9YDtcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gX192YWw7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogIEZpbmQgdGhlIGZpcnN0IHdoaXRlc3BhY2VzIGluIHRleHQgYW5kIHJlbW92ZSB0aGVtIGZyb20gdGhlXG4gICAgICogIHN0YXJ0IG9mIHRoZSBmb2xsb3dpbmcgbGluZXMuXG4gICAgICpcbiAgICAgKiAgQHBhcmFtIHtzdHJpbmd9IHN0clxuICAgICAqICBAcmV0dXJuIHtzdHJpbmd9XG4gICAgICovXG4gICAgdW5pbmRlbnRUZXh0KHN0cikge1xuICAgICAgICBsZXQgaSA9IHN0ci5tYXRjaCgvXFxuKFxccyopL20pWzFdO1xuICAgICAgICBzdHIgPSBzdHIucmVwbGFjZShuZXcgUmVnRXhwKGBcXG4ke2l9YCwgXCJnXCIpLCBcIlxcblwiKTtcbiAgICAgICAgc3RyID0gc3RyLnRyaW0oKTtcbiAgICAgICAgcmV0dXJuIHN0cjtcbiAgICB9XG5cblxufSIsIlxudmFyIF9LVF9FTEVNRU5UX0lEID0gMDtcblxuY2xhc3MgS3RSZW5kZXJhYmxlIGV4dGVuZHMgSFRNTFRlbXBsYXRlRWxlbWVudCB7XG5cblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIC8qKlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7S3RIZWxwZXJ9XG4gICAgICAgICAqIEBwcm90ZWN0ZWRcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2hscHIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogQXJyYXkgd2l0aCBhbGwgb2JzZXJ2ZWQgZWxlbWVudHMgb2YgdGhpcyB0ZW1wbGF0ZVxuICAgICAgICAgKlxuICAgICAgICAgKiBudWxsIGluZGljYXRlcywgdGhlIHRlbXBsYXRlIHdhcyBub3QgeWV0IHJlbmRlcmVkXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtIVE1MRWxlbWVudFtdfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcImRlYnVnXCI6IGZhbHNlfTtcblxuICAgICAgICAvKipcbiAgICAgICAgICogVGhlIGludGVybmFsIGVsZW1lbnQgaWQgdG8gaWRlbnRpZnkgd2hpY2ggZWxlbWVudHNcbiAgICAgICAgICogdG8gcmVuZGVyLlxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7bnVtYmVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9rdElkID0gKytfS1RfRUxFTUVOVF9JRDtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBfbG9nKHYxLCB2MiwgdjMpIHtcbiAgICAgICAgbGV0IGEgPSBbIHRoaXMuY29uc3RydWN0b3IubmFtZSArIFwiI1wiICsgdGhpcy5pZCArIFwiW1wiICsgdGhpcy5fa3RJZCArIFwiXTpcIl07XG5cbiAgICAgICAgZm9yIChsZXQgZSBvZiBhcmd1bWVudHMpXG4gICAgICAgICAgICBhLnB1c2goZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSlcbiAgICAgICAgICAgIGNvbnNvbGUubG9nLmFwcGx5KHRoaXMsIGEpO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogV2FsayB0aHJvdWdoIGFsbCBlbGVtZW50cyBhbmQgdHJ5IHRvIHJlbmRlciB0aGVtLlxuICAgICAqXG4gICAgICogaWYgYSBlbGVtZW50IGhhcyB0aGUgX2thTWIgKG1haW50YWluZWQgYnkpIHByb3BlcnR5IHNldCxcbiAgICAgKiBjaGVjayBpZiBpdCBlcXVhbHMgdGhpcy5fa2FJZCAodGhlIGVsZW1lbnQgaWQpLiBJZiBub3QsXG4gICAgICogc2tpcCB0aGlzIG5vZGUuXG4gICAgICpcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IG5vZGVcbiAgICAgKiBAcGFyYW0ge29iamVjdH0gJHNjb3BlXG4gICAgICovXG4gICAgcmVuZGVyUmVjdXJzaXZlKG5vZGUsICRzY29wZSkge1xuICAgICAgICBpZiAobm9kZS5oYXNPd25Qcm9wZXJ0eShcIl9rYU1iXCIpICYmIG5vZGUuX2thTWIgIT09IHRoaXMuX2t0SWQpXG4gICAgICAgICAgICByZXR1cm47XG5cbiAgICAgICAgbGV0IHJlZlByb21pc2UgPSBudWxsO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHJlZmVyZW5jZXNcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBub2RlLmhhc0F0dHJpYnV0ZShcIipyZWZcIikpIHtcbiAgICAgICAgICAgIGxldCByZWZuYW1lID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqcmVmXCIpO1xuICAgICAgICAgICAgcmVmUHJvbWlzZSA9ICRzY29wZS4kcmVmW3JlZm5hbWVdO1xuICAgICAgICAgICAgJHNjb3BlLiRyZWZbcmVmbmFtZV0gPSBub2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gUmVnaXN0ZXIgaWQgb2YgY2xvbmVkIG5vZGVcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBIVE1MRWxlbWVudCAmJiBub2RlLmhhc0F0dHJpYnV0ZShcIippZFwiKSkge1xuICAgICAgICAgICAgbm9kZS5pZCA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmlkXCIpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLnJlbmRlciA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICBub2RlLnJlbmRlcigkc2NvcGUpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG5cbiAgICAgICAgZm9yKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKG5vZGUua3RTa2lwUmVuZGVyID09PSB0cnVlKVxuICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ck5vZGUsICRzY29wZSk7XG4gICAgICAgIH1cblxuICAgICAgICBpZiAocmVmUHJvbWlzZSAhPT0gbnVsbCAmJiB0eXBlb2YgcmVmUHJvbWlzZS5yZXNvbHZlID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICAgICAgICAgIC8vIFJlc29sdmUgcHJvbWlzZSByZWdpc3RlcmVkIHdpdGggd2FpdFJlZigpXG4gICAgICAgICAgICByZWZQcm9taXNlLnJlc29sdmUobm9kZSk7XG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBfcmVtb3ZlTm9kZXMoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBlbC5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBlbC5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgIGlmICh0aGlzLnBhcmVudEVsZW1lbnQgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9lbHMgPSBudWxsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIENsb25lIGFuZCBhcHBlbmQgYWxsIGVsZW1lbnRzIGluXG4gICAgICogY29udGVudCBvZiB0ZW1wbGF0ZSB0byB0aGUgbmV4dCBzaWJsaW5nLlxuICAgICAqXG4gICAgICogQHBhcmFtIHNpYmxpbmdcbiAgICAgKiBAcHJvdGVjdGVkXG4gICAgICovXG4gICAgX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoc2libGluZykge1xuICAgICAgICBpZiAodHlwZW9mIHNpYmxpbmcgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICBzaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuICAgICAgICBsZXQgY24gPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICB0aGlzLl9lbHMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY2VsIG9mIGNuLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjZWwuX2thTWIgPSB0aGlzLl9rdElkO1xuICAgICAgICAgICAgdGhpcy5fZWxzLnB1c2goY2VsKTtcbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUoY24sIHNpYmxpbmcpO1xuXG4gICAgfVxuXG59XG5cblxuXG4iLCJcblxuY2xhc3MgS3RUZW1wbGF0ZVBhcnNlciB7XG5cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHRleHRcbiAgICAgKiBAcGFyYW0ge0RvY3VtZW50RnJhZ21lbnR9IGZyYWdtZW50XG4gICAgICogQHJldHVybiB7bnVsbH1cbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9wYXJzZVRleHROb2RlICh0ZXh0LCBmcmFnbWVudCkge1xuICAgICAgICBsZXQgc3BsaXQgPSB0ZXh0LnNwbGl0KC8oXFx7XFx7fFxcfVxcfSkvKTtcbiAgICAgICAgd2hpbGUoc3BsaXQubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQobmV3IFRleHQoc3BsaXQuc2hpZnQoKSkpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMClcbiAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgc3BsaXQuc2hpZnQoKTtcbiAgICAgICAgICAgIGxldCB2YWwgPSBuZXcgS2FWYWwoKTtcbiAgICAgICAgICAgIHZhbC5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIHNwbGl0LnNoaWZ0KCkudHJpbSgpKTtcbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBmcmFnbWVudC5hcHBlbmRDaGlsZCh2YWwpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICovXG4gICAgcGFyc2VSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICAvL2NvbnNvbGUubG9nKFwiW2thLXRwbF0gcGFyc2VSZWN1cnNpdmUoXCIsIG5vZGUsIFwiKVwiKTtcbiAgICAgICAgaWYgKG5vZGUgaW5zdGFuY2VvZiBEb2N1bWVudEZyYWdtZW50KSB7XG4gICAgICAgICAgICBmb3IgKGxldCBuIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJzZVJlY3Vyc2l2ZShuKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChub2RlLnRhZ05hbWUgPT09IFwiU0NSSVBUXCIpXG4gICAgICAgICAgICByZXR1cm47IC8vIERvbid0IHBhcnNlIGJld2VlbiA8c2NyaXB0Pjwvc2NyaXB0PiB0YWdzXG5cbiAgICAgICAgaWYgKHR5cGVvZiBub2RlLmdldEF0dHJpYnV0ZSAhPT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGlmIChub2RlLmt0UGFyc2VkID09PSB0cnVlKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIG5vZGUua3RQYXJzZWQgPSB0cnVlO1xuXG4gICAgICAgIGZvciAobGV0IHRleHROb2RlIG9mIG5vZGUuY2hpbGROb2Rlcykge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiB0ZXh0Tm9kZS5kYXRhID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgbGV0IGZyYWdtZW50ID0gbmV3IERvY3VtZW50RnJhZ21lbnQoKTtcbiAgICAgICAgICAgIHRoaXMuX3BhcnNlVGV4dE5vZGUodGV4dE5vZGUuZGF0YSwgZnJhZ21lbnQpO1xuICAgICAgICAgICAgdGV4dE5vZGUucmVwbGFjZVdpdGgoZnJhZ21lbnQpO1xuXG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS5oYXNBdHRyaWJ1dGUoXCIqZm9yXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia2EtbG9vcFwifSk7XG4gICAgICAgICAgICBsZXQgYXR0ciA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvclwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuXG4gICAgICAgICAgICBsZXQgbWEgPSBhdHRyLm1hdGNoKC9sZXRcXHMrKFxcUyopXFxzKyhpbnxvZnxyZXBlYXQpXFxzKyhcXFMqKShcXHMraW5kZXhieVxccysoXFxTKikpPy8pO1xuICAgICAgICAgICAgaWYgKG1hICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3Jtb2RlXCIsIG1hWzJdKTtcbiAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcnNlbGVjdFwiLCBtYVszXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JkYXRhXCIsIG1hWzFdKTtcbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIG1hWzVdICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgICAgICAgICBuZXdOb2RlLnNldEF0dHJpYnV0ZShcImZvcmlkeFwiLCBtYVs1XSk7XG4gICAgICAgICAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvcmV2YWxcIikpIHtcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JldmFsXCIsIG5vZGUuZ2V0QXR0cmlidXRlKFwiKmZvcmV2YWxcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJDYW5ub3QgcGFyc2UgKmZvcj0nXCIgKyBhdHRyICsgXCInIGZvciBlbGVtZW50IFwiICsgbm9kZS5vdXRlckhUTUw7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgLy8gSWYgcnVucyBhZnRlciAqZm9yICh0byBmaWx0ZXIgZm9yIHZhbHVlcylcbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmlmXCIpKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtaWZcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZlwiKTtcbiAgICAgICAgICAgIC8qIEB2YXIge0hUTUxUZW1wbGF0ZUVsZW1lbnR9IG5ld05vZGUgKi9cbiAgICAgICAgICAgIGxldCBjbG9uZU5vZGUgPSBub2RlLmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgICAgIG5ld05vZGUuY29udGVudC5hcHBlbmRDaGlsZChjbG9uZU5vZGUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJzdG10XCIsIGF0dHIpO1xuICAgICAgICAgICAgbm9kZS5yZXBsYWNlV2l0aChuZXdOb2RlKTtcbiAgICAgICAgICAgIG5vZGUgPSBjbG9uZU5vZGU7XG4gICAgICAgIH1cblxuICAgICAgICBsZXQgY3NzQ2xhc3NlcyA9IFtdO1xuICAgICAgICBsZXQga3RDbGFzc2VzID0gbnVsbDtcbiAgICAgICAgbGV0IGF0dHJzID0gW107XG4gICAgICAgIGxldCBldmVudHMgPSB7fTtcbiAgICAgICAgbGV0IHN0eWxlcyA9IFtdO1xuXG4gICAgICAgIGxldCByZWdleCA9IG5ldyBSZWdFeHAoXCJeXFxcXFsoLispXFxcXF0kXCIpO1xuICAgICAgICBmb3IobGV0IGF0dHJOYW1lIG9mIG5vZGUuZ2V0QXR0cmlidXRlTmFtZXMoKSkge1xuXG4gICAgICAgICAgICBsZXQgcmVzdWx0ID0gcmVnZXguZXhlYyhhdHRyTmFtZSk7XG4gICAgICAgICAgICBpZiAocmVzdWx0ID09PSBudWxsKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuXG4gICAgICAgICAgICBsZXQgc3BsaXQgPSByZXN1bHRbMV0uc3BsaXQoXCIuXCIpO1xuICAgICAgICAgICAgaWYgKHNwbGl0Lmxlbmd0aCA9PT0gMSkge1xuICAgICAgICAgICAgICAgIGF0dHJzLnB1c2goYCcke3NwbGl0WzBdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBzd2l0Y2ggKHNwbGl0WzBdKSB7XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJjbGFzc2xpc3RcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGlmIChzcGxpdFsxXSA9PT0gXCJcIikge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIGt0Q2xhc3NlcyA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgICAgICAgICAgY3NzQ2xhc3Nlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJvblwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgZXZlbnRzW3NwbGl0WzFdXSA9IG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCJzdHlsZVwiOlxuICAgICAgICAgICAgICAgICAgICAgICAgc3R5bGVzLnB1c2goYCcke3NwbGl0WzFdfSc6IGAgKyBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSkpO1xuICAgICAgICAgICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgICAgICAgICAgZGVmYXVsdDpcbiAgICAgICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkludmFsaWQgYXR0cmlidXRlICdcIiArIGF0dHJOYW1lICsgXCInXCIpXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDAgfHwgY3NzQ2xhc3Nlcy5sZW5ndGggPiAwIHx8IGt0Q2xhc3NlcyAhPT0gbnVsbCB8fCBPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDAgfHwgc3R5bGVzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGxldCBuZXdOb2RlID0gZG9jdW1lbnQuY3JlYXRlRWxlbWVudChcInRlbXBsYXRlXCIsIHtpczogXCJrdC1tYWludGFpblwifSk7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuXG4gICAgICAgICAgICBpZiAoYXR0cnMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtYXR0cnNcIiwgXCJ7XCIgKyBhdHRycy5qb2luKFwiLFwiKSArIFwifVwiKTtcblxuICAgICAgICAgICAgaWYgKHN0eWxlcy5sZW5ndGggPiAwKVxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1zdHlsZXNcIiwgXCJ7XCIgKyBzdHlsZXMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChrdENsYXNzZXMgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAvLyBpbmNsdWRlIFtjbGFzc2xpc3QuXT1cIntjbGFzczogY29uZH1cIlxuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIGt0Q2xhc3Nlcyk7XG4gICAgICAgICAgICB9IGVsc2UgaWYgKGNzc0NsYXNzZXMubGVuZ3RoID4gMCkge1xuICAgICAgICAgICAgICAgIGNsb25lTm9kZS5zZXRBdHRyaWJ1dGUoXCJrdC1jbGFzc2VzXCIsIFwie1wiICsgY3NzQ2xhc3Nlcy5qb2luKFwiLFwiKSArIFwifVwiKTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgaWYgKE9iamVjdC5rZXlzKGV2ZW50cykubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtb25cIiwgSlNPTi5zdHJpbmdpZnkoZXZlbnRzKSk7XG5cbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cblxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2Ygbm9kZS5jaGlsZHJlbilcbiAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUoY3VyTm9kZSk7XG5cblxuXG4gICAgfVxuXG59IiwiLyoqXG4gKlxuICogQHJldHVybiBLYVRwbFxuICovXG5mdW5jdGlvbiBrYV90cGwoc2VsZWN0b3IpIHtcbiAgICBpZiAoc2VsZWN0b3IgaW5zdGFuY2VvZiBLYVRwbClcbiAgICAgICAgcmV0dXJuIHNlbGVjdG9yO1xuICAgIGxldCBlbGVtID0gZG9jdW1lbnQuZ2V0RWxlbWVudEJ5SWQoc2VsZWN0b3IpO1xuICAgIGlmIChlbGVtIGluc3RhbmNlb2YgS2FUcGwpIHtcbiAgICAgICAgcmV0dXJuIGVsZW07XG4gICAgfVxuICAgIHRocm93IGBTZWxlY3RvciAnJHtzZWxlY3Rvcn0nIGlzIG5vdCBhIDx0ZW1wbGF0ZSBpcz1cImthLXRwbFwiPiBlbGVtZW50YDtcbn1cblxuXG5cbnZhciBLVF9GTiA9IHtcbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVsZW1cbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gdmFsXG4gICAgICogQHBhcmFtIHNjb3BlXG4gICAgICovXG4gICAgXCJrdC1jbGFzc2VzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBjbGFzc2VzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBjbGFzc05hbWUgaW4gY2xhc3Nlcykge1xuICAgICAgICAgICAgaWYgKCAhIGNsYXNzZXMuaGFzT3duUHJvcGVydHkoY2xhc3NOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChjbGFzc2VzW2NsYXNzTmFtZV0gPT09IHRydWUpIHtcbiAgICAgICAgICAgICAgICBlbGVtLmNsYXNzTGlzdC5hZGQoY2xhc3NOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QucmVtb3ZlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3Qtc3R5bGVzXCI6IGZ1bmN0aW9uKGVsZW0sIHZhbCwgc2NvcGUpIHtcbiAgICAgICAgXCJ1c2Ugc3RyaWN0XCI7XG5cbiAgICAgICAgbGV0IGt0aGVscGVyID0gbmV3IEt0SGVscGVyKCk7XG4gICAgICAgIGxldCBzdHlsZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IHN0eWxlTmFtZSBpbiBzdHlsZXMpIHtcbiAgICAgICAgICAgIGlmICggISBzdHlsZXMuaGFzT3duUHJvcGVydHkoc3R5bGVOYW1lKSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGlmIChzdHlsZXNbc3R5bGVOYW1lXSA9PT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUucmVtb3ZlUHJvcGVydHkoc3R5bGVOYW1lKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zdHlsZS5zZXRQcm9wZXJ0eShzdHlsZU5hbWUsIHN0eWxlc1tzdHlsZU5hbWVdKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH0sXG5cbiAgICBcImt0LWF0dHJzXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdICE9PSBudWxsICYmIGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnNldEF0dHJpYnV0ZShjbGFzc05hbWUsIGNsYXNzZXNbY2xhc3NOYW1lXSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0ucmVtb3ZlQXR0cmlidXRlKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuICAgIFwia3Qtb25cIjogZnVuY3Rpb24gKGVsZW0sIHZhbCwgJHNjb3BlKSB7XG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuXG4gICAgICAgIC8vIENsb25lIHRoZSBmaXJzdCBsYXllciBvZiB0aGUgc2NvcGUgc28gaXQgY2FuIGJlIGV2YWx1YXRlZCBvbiBldmVudFxuICAgICAgICBsZXQgc2F2ZVNjb3BlID0gey4uLiRzY29wZX07XG4gICAgICAgIHNhdmVTY29wZS4kc2NvcGUgPSAkc2NvcGU7XG4gICAgICAgIC8vc2F2ZVNjb3BlLiRyZWYgPSAkc2NvcGUuJHJlZjtcblxuICAgICAgICBsZXQgZXZlbnRzID0gSlNPTi5wYXJzZSh2YWwpO1xuICAgICAgICBmb3IgKGxldCBldmVudCBpbiBldmVudHMpIHtcbiAgICAgICAgICAgIGVsZW1bXCJvblwiICsgZXZlbnRdID0gKGUpID0+IHtcbiAgICAgICAgICAgICAgICBrdGhlbHBlci5rZXZhbChldmVudHNbZXZlbnRdLCBzYXZlU2NvcGUsIGVsZW0pO1xuICAgICAgICAgICAgICAgIHJldHVybiBmYWxzZTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgfVxufTsiLCJcblxuY2xhc3MgS2FJbmNsdWRlIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzcmNcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYXV0b1wiOiBudWxsLFxuICAgICAgICAgICAgXCJyYXdcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2VcbiAgICAgICAgfVxuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wic3JjXCIsIFwiZGVidWdcIiwgXCJhdXRvXCIsIFwicmF3XCJdO1xuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogPHNjcmlwdD4gdGFncyB0aGF0IHdlcmUgbG9hZGVkIHZpYSBhamF4IHdvbid0IGJlIGV4ZWN1dGVkXG4gICAgICogd2hlbiBhZGRlZCB0byBkb20uXG4gICAgICpcbiAgICAgKiBUaGVyZWZvcmUgd2UgaGF2ZSB0byByZXdyaXRlIHRoZW0uIFRoaXMgbWV0aG9kIGRvZXMgdGhpc1xuICAgICAqIGF1dG9tYXRpY2FsbHkgYm90aCBmb3Igbm9ybWFsIGFuZCBmb3IgdGVtcGxhdGUgKGNvbnRlbnQpIG5vZGVzLlxuICAgICAqXG4gICAgICogQHBhcmFtIG5vZGVcbiAgICAgKiBAcHJpdmF0ZVxuICAgICAqL1xuICAgIF9pbXBvcnRTY3JpdHBSZWN1cnNpdmUobm9kZSkge1xuICAgICAgICBsZXQgY2hlbHMgPSBub2RlIGluc3RhbmNlb2YgSFRNTFRlbXBsYXRlRWxlbWVudCA/IG5vZGUuY29udGVudC5jaGlsZE5vZGVzIDogbm9kZS5jaGlsZE5vZGVzO1xuXG4gICAgICAgIGZvciAobGV0IHMgb2YgY2hlbHMpIHtcbiAgICAgICAgICAgIGlmIChzLnRhZ05hbWUgIT09IFwiU0NSSVBUXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUocyk7XG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBsZXQgbiA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJzY3JpcHRcIik7XG4gICAgICAgICAgICBuLmlubmVySFRNTCA9IHMuaW5uZXJIVE1MO1xuICAgICAgICAgICAgcy5yZXBsYWNlV2l0aChuKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgX2xvYWREYXRhUmVtb3RlKCkge1xuICAgICAgICBsZXQgeGh0dHAgPSBuZXcgWE1MSHR0cFJlcXVlc3QoKTtcblxuICAgICAgICB4aHR0cC5vcGVuKFwiR0VUXCIsIHRoaXMuX2F0dHJzLnNyYyk7XG4gICAgICAgIHhodHRwLm9ucmVhZHlzdGF0ZWNoYW5nZSA9ICgpID0+IHtcbiAgICAgICAgICAgIGlmICh4aHR0cC5yZWFkeVN0YXRlID09PSA0KSB7XG4gICAgICAgICAgICAgICAgaWYgKHhodHRwLnN0YXR1cyA+PSA0MDApIHtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS53YXJuKFwiQ2FuJ3QgbG9hZCAnXCIgKyB0aGlzLnBhcmFtcy5zcmMgKyBcIic6IFwiICsgeGh0dHAucmVzcG9uc2VUZXh0KTtcbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICB0aGlzLmlubmVySFRNTCA9IHhodHRwLnJlc3BvbnNlVGV4dDtcbiAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMucmF3ICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgICAgIGxldCBwID0gbmV3IEt0VGVtcGxhdGVQYXJzZXIoKTtcbiAgICAgICAgICAgICAgICAgICAgcC5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIC8vIE5vZGVzIGxvYWRlZCBmcm9tIHJlbW90ZSB3b24ndCBnZXQgZXhlY3V0ZWQuIFNvIGltcG9ydCB0aGVtLlxuICAgICAgICAgICAgICAgIHRoaXMuX2ltcG9ydFNjcml0cFJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2coXCJ0cmlnZ2VyIERPTUNvbnRlbnRMb2FkZWQgZXZlbnQgb25cIiwgZWwpO1xuICAgICAgICAgICAgICAgICAgICBlbC5kaXNwYXRjaEV2ZW50KG5ldyBFdmVudChcIkRPTUNvbnRlbnRMb2FkZWRcIikpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcblxuICAgICAgICB4aHR0cC5zZW5kKCk7XG4gICAgfVxuXG4gICAgZGlzY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGZvciAobGV0IGVsIG9mIHRoaXMuX2VscylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgfVxuXG4gICAgY29ubmVjdGVkQ2FsbGJhY2soKSB7XG4gICAgICAgIGxldCBhdXRvID0gdGhpcy5nZXRBdHRyaWJ1dGUoXCJhdXRvXCIpO1xuICAgICAgICBpZiAoYXV0byAhPT0gbnVsbCkge1xuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2FkRGF0YVJlbW90ZSgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgcmVuZGVyKGNvbnRleHQpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcblxuXG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS1pbmNsdWRlXCIsIEthSW5jbHVkZSwge2V4dGVuZHM6IFwidGVtcGxhdGVcIn0pOyIsIlxuXG5cbmNsYXNzIEthTG9vcCBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9vcmlnU2libGluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZm9yc2VsZWN0XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcm1vZGVcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yaWR4XCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmRhdGFcIjogbnVsbCxcbiAgICAgICAgICAgIFwiZm9yZXZhbFwiOiBudWxsXG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJmb3JzZWxlY3RcIiwgXCJmb3JpZHhcIiwgXCJmb3JkYXRhXCIsIFwiZm9yZXZhbFwiLCBcImZvcm1vZGVcIl07XG4gICAgfVxuXG5cbiAgICBfYXBwZW5kRWxlbSgpIHtcbiAgICAgICAgbGV0IG5ld05vZGUgPSB0aGlzLmNvbnRlbnQuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICBsZXQgbm9kZXMgPSBbXTtcbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiBuZXdOb2RlLmNoaWxkcmVuKSB7XG4gICAgICAgICAgICBjdXJOb2RlLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIG5vZGVzLnB1c2goY3VyTm9kZSk7XG4gICAgICAgIH1cbiAgICAgICAgZm9yIChsZXQgaSA9IDA7IGkgPCBub2Rlcy5sZW5ndGg7IGkrKylcbiAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5pbnNlcnRCZWZvcmUobm9kZXNbaV0sIHRoaXMuX29yaWdTaWJsaW5nKTtcbiAgICAgICAgdGhpcy5fZWxzLnB1c2goe1xuICAgICAgICAgICAgbm9kZTogbm9kZXNcbiAgICAgICAgfSk7XG4gICAgfVxuXG5cbiAgICBfbWFpbnRhaW5Ob2RlKGksICRzY29wZSkge1xuICAgICAgICBpZiAodGhpcy5fZWxzLmxlbmd0aCA8IGkrMSlcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW0oKTtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmlkeCAhPT0gbnVsbClcbiAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JpZHhdID0gaTtcblxuICAgICAgICBpZiAodGhpcy5fYXR0cnMuZm9yZXZhbCAhPT0gbnVsbClcbiAgICAgICAgICAgIHRoaXMuX2hscHIua2V2YWwodGhpcy5fYXR0cnMuZm9yZXZhbCwgJHNjb3BlLCB0aGlzKTtcblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIHRoaXMuX2Vsc1tpXS5ub2RlKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgfVxuXG5cbiAgICByZW5kZXIoJHNjb3BlKSB7XG4gICAgICAgIGxldCBfYV9zZWwgPSB0aGlzLl9hdHRycy5mb3JzZWxlY3Q7XG4gICAgICAgIGxldCBzZWwgPSB0aGlzLl9obHByLnNjb3BlRXZhbCgkc2NvcGUsIF9hX3NlbCwgdGhpcyk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcm1vZGUgIT09IFwicmVwZWF0XCIpIHtcblxuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwib2JqZWN0XCIpIHtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYEludmFsaWQgZm9yU2VsZWN0PVwiJHtfYV9zZWx9XCIgcmV0dXJuZWQ6YCwgc2VsLCBcIm9uIGNvbnRleHRcIiwgY29udGV4dCwgXCIoRWxlbWVudDogXCIsIHRoaXMsIFwiKVwiKTtcbiAgICAgICAgICAgICAgICB0aHJvdyBcIkludmFsaWQgZm9yU2VsZWN0IHNlbGVjdG9yLiBzZWUgd2FyaW5nLlwiXG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChzZWwgPT09IG51bGwgfHwgKHR5cGVvZiBzZWxbU3ltYm9sLml0ZXJhdG9yXSAhPT0gXCJmdW5jdGlvblwiICYmIHR5cGVvZiBzZWwgIT09ICdvYmplY3QnKSApIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpO1xuICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBub3QgaXRlcmFibGUuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHNlbCAhPT0gXCJudW1iZXJcIikge1xuICAgICAgICAgICAgICAgIHRoaXMuX2xvZyhgU2VsZWN0b3IgJyR7X2Ffc2VsfScgaW4gZm9yIHN0YXRlbWVudCBpcyBhIG51bWJlci4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgYSBudW1iZXIuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcylcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgICAgICBpZiAodGhpcy5fb3JpZ1NpYmxpbmcgPT09IGZhbHNlKVxuICAgICAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSB0aGlzLm5leHRTaWJsaW5nO1xuXG5cbiAgICAgICAgbGV0IG4gPSAwO1xuICAgICAgICBzd2l0Y2ggKHRoaXMuX2F0dHJzLmZvcm1vZGUpIHtcbiAgICAgICAgICAgIGNhc2UgXCJpblwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvcihsZXQgaSBpbiBzZWwpIHtcbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJvZlwiOlxuICAgICAgICAgICAgICAgIG4gPSAwO1xuICAgICAgICAgICAgICAgIGZvciAobGV0IGkgb2Ygc2VsKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgJHNjb3BlW3RoaXMuX2F0dHJzLmZvcmRhdGFdID0gaTtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbWFpbnRhaW5Ob2RlKG4sICRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIG4rKztcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIGNhc2UgXCJyZXBlYXRcIjpcbiAgICAgICAgICAgICAgICBmb3IgKG49MDsgbiA8IHNlbDsgbisrKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IG47XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBicmVhaztcbiAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvciB0eXBlICdcIiArIHRoaXMuX2F0dHJzLmZvcm1vZGUgKyBcIicgaW4gXCIgLiB0aGlzLm91dGVySFRNTDtcbiAgICAgICAgfVxuXG5cbiAgICAgICAgZm9yIChsZXQgaWR4ID0gbjsgc2VsLmxlbmd0aCA8IHRoaXMuX2Vscy5sZW5ndGg7IGlkeCsrKSB7XG4gICAgICAgICAgICBsZXQgZWxlbSA9IHRoaXMuX2Vscy5wb3AoKTtcbiAgICAgICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgZWxlbS5ub2RlKSB7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBjdXJOb2RlLl9yZW1vdmVOb2RlcyA9PT0gXCJmdW5jdGlvblwiKVxuICAgICAgICAgICAgICAgICAgICBjdXJOb2RlLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChjdXJOb2RlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtbG9vcFwiLCBLYUxvb3AsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJ2YXIgS0FTRUxGID0gbnVsbDtcblxuY2xhc3MgS2FUcGwgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlLFxuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImFmdGVycmVuZGVyXCI6IG51bGwsXG4gICAgICAgICAgICBcIm5vZGVib3VuY2VcIjogZmFsc2VcbiAgICAgICAgfTtcblxuICAgICAgICAvLyBTd2l0Y2hlZCB0byB0byBkdXJpbmcgX2luaXQoKSB0byBhbGxvdyA8c2NyaXB0PiB0byBzZXQgc2NvcGUgd2l0aG91dCByZW5kZXJpbmcuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgICAgIHRoaXMuX3JlZnMgPSB7fTtcbiAgICAgICAgdGhpcy5fc2NvcGUgPSB7XCIkcmVmXCI6dGhpcy5fcmVmc307XG4gICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICB0aGlzLl9oYW5kbGVyID0ge307XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmVmZXIgdG8gdGhlIGN1cnJlbnQgdGVtcGxhdGUgKHNob3VsZCBiZSB1c2VkIGJ5IDxzY3JpcHQ+IGluc2lkZSBhIHRlbXBsYXRlIHRvIHJlZmVyZW5jZSB0aGVcbiAgICAgKiBjdXJyZW50IHRlbXBsYXRlXG4gICAgICpcbiAgICAgKiBAdHlwZSB7S2FUcGx9XG4gICAgICovXG4gICAgc3RhdGljIGdldCBzZWxmKCkge1xuICAgICAgICByZXR1cm4gS2FUcGwucHJvdG90eXBlLnNlbGY7XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiZGVidWdcIl07XG4gICAgfVxuXG5cbiAgICBkaXNjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwiY29ubmVjdGVkQ2FsbGJhY2soKVwiLCB0aGlzKTtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIilcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhcImF1dG9zdGFydDogX2luaXQoKVwiLCBcImRvY3VtZW50LnJlYWR5U3RhdGU6IFwiLCBkb2N1bWVudC5yZWFkeVN0YXRlKTtcblxuICAgICAgICAgICAgbGV0IGluaXQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICAgICAgICAgIGlmIChhdXRvID09PSBcIlwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBldmFsKGF1dG8pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuICAgICAgICB0aGlzLl9zY29wZS4kcmVmID0gdGhpcy5fcmVmcztcblxuICAgICAgICAvLyBSZW5kZXIgb25seSBpZiBkb20gYXZhaWxhYmxlIChhbGxvdyA8c2NyaXB0PiBpbnNpZGUgdGVtcGxhdGUgdG8gc2V0IHNjb3BlIGJlZm9yZSBmaXJzdCByZW5kZXJpbmdcbiAgICAgICAgaWYgKCAhIHRoaXMuX2lzSW5pdGlhbGl6aW5nKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXIodGhpcy5fc2NvcGUpO1xuICAgIH1cblxuICAgIGdldCAkc2NvcGUoKSB7XG4gICAgICAgIGxldCBoYW5kbGVyID0ge1xuICAgICAgICAgICAgc2V0OiAodGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUsIHJlY2VpdmVyKSA9PiB7XG4gICAgICAgICAgICAgICAgLy9jb25zb2xlLmxvZyAoXCJzZXQ6XCIsIHRhcmdldCwgcHJvcGVydHksIHZhbHVlKTtcbiAgICAgICAgICAgICAgICB0YXJnZXRbcHJvcGVydHldID0gdmFsdWU7XG4gICAgICAgICAgICAgICAgLy8gRG9uJ3QgdXBkYXRlIHByb3h5IGR1cmluZyByZW5kZXJpbmcgKHJlY3Vyc2lvbilcbiAgICAgICAgICAgICAgICBpZiAoICEgdGhpcy5faXNSZW5kZXJpbmcpIHtcbiAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLm5vZGVib3VuY2UgPT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgICAgICAgICAvLyBEZWZhdWx0IGJlaGF2aW91cjogRGVib3VuY2U6IFNvIHlvdSBjYW4gZG8gbXVsdGlwbGUgJHNjb3BlIHVwZGF0ZWQgd2l0aCByZW5kaW5nIG9ubHkgb25jZVxuICAgICAgICAgICAgICAgICAgICAgICAgaWYgKHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgIT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB3aW5kb3cuY2xlYXJUaW1lb3V0KHRoaXMuX19kZWJvdW5jZVRpbWVvdXQpO1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMuX19kZWJvdW5jZVRpbWVvdXQgPSBudWxsO1xuICAgICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IHdpbmRvdy5zZXRUaW1lb3V0KCgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICB9LCAxMCk7XG4gICAgICAgICAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgICAgIH1cblxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICByZXR1cm4gdHJ1ZTtcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBnZXQ6ICh0YXJnZXQsIGtleSkgPT4ge1xuICAgICAgICAgICAgICAgIGlmIChrZXkgPT09IFwiJHJlZlwiKSB7XG5cbiAgICAgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuX3JlZnM7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgdGFyZ2V0W2tleV0gPT09IFwib2JqZWN0XCIgJiYgdGFyZ2V0W2tleV0gIT09IG51bGwpXG4gICAgICAgICAgICAgICAgICAgIHJldHVybiBuZXcgUHJveHkodGFyZ2V0W2tleV0sIGhhbmRsZXIpO1xuICAgICAgICAgICAgICAgIHJldHVybiB0YXJnZXRba2V5XTtcbiAgICAgICAgICAgIH1cblxuICAgICAgICB9O1xuICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRoaXMuX3Njb3BlLCBoYW5kbGVyKTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBFeGVjdXRlIGN1c3RvbSBmdW5jdGlvbnMgZnJvbSBvdXRzaWRlIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogICAgIGthX3RwbChcInRwbDFcIikuJGZuLmRvU29tZXRoaW5nKCk7XG4gICAgICogPC9leGFtcGxlPlxuICAgICAqXG4gICAgICogQHJldHVybiB7e2N1c3RvbUZuOiAoZnVuY3Rpb24oKik6IHN0cmluZyl9fHt9fVxuICAgICAqL1xuICAgIGdldCAkZm4gKCkge1xuICAgICAgICByZXR1cm4gdGhpcy4kc2NvcGUuJGZuO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqIEluaXRpYWxpemUgdGhlIHNjb3BlLiBXaWxsIHJldHVybiB0aGUgcHJveGllZCBzY29wZSBvYmplY3QuXG4gICAgICpcbiAgICAgKiBUaGUgcHJveHkga2VlcHMgdHJhY2sgYWJvdXQgY2hhbmdlcyB0byAkc2NvcGUgYW5kIHJlcmVuZGVycyB0aGVcbiAgICAgKiBkYXRhIHRoZW4uXG4gICAgICpcbiAgICAgKiBTbyB5b3UgY2FuIHVzZSB0aGUgcmV0dXJuIHZhbHVlIHdpdGhpbiB0aGUgc2NvcGUgZGVmaW5pdGlvbiBpdHNlbGYuXG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiBsZXQgJHNjb3BlID0gS2FUcGwuc2VsZi5zY29wZUluaXQoe1xuICAgICAqICAgICBzb21lRGF0YTogW10sXG4gICAgICpcbiAgICAgKiAgICAgJGZuOiB7XG4gICAgICogICAgICAgICB1cGRhdGU6ICgpID0+IHtcbiAgICAgKiAgICAgICAgICAgICAkc2NvcGUuc29tZURhdGEucHVzaChcIkl0ZW1cIilcbiAgICAgKiAgICAgICAgIH1cbiAgICAgKiAgICAgfVxuICAgICAqIH0pO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSB7eyRmbjp7fX19ICRzY29wZVxuICAgICAqIEByZXR1cm4ge1Byb3h5PHt9Pn1cbiAgICAgKi9cbiAgICBzY29wZUluaXQoJHNjb3BlKSB7XG4gICAgICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xuICAgICAgICByZXR1cm4gdGhpcy4kc2NvcGU7IC8vIDwtIFF1ZXJ5IHNjb3BlIG92ZXIgZ2V0dGVyIHRvIHJlY2VpdmUgcHJveHlcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhaXQgZm9yIGEgcmVmZXJlbmNlIHRvIGJlIHJlbmRlcmVkXG4gICAgICpcbiAgICAgKiBSZXR1cm5zIGEgcHJvbWlzZSB0aGF0IGlzIHJlc29sdmVkIG9uY2UgdGhlIFJlZmVyZW5jZWRcbiAgICAgKiBFbGVtZW50IChjb250YWluaW5nICpyZWYgYXR0cmlidXRlKSBpbiB0ZW1wbGF0ZSBhbmQgYWxsIGl0c1xuICAgICAqIGNoaWxkIGVsZW1lbnRzIHdhcyByZW5kZXJlZC5cbiAgICAgKlxuICAgICAqIElmIHRoZSBlbGVtZW50XG4gICAgICpcbiAgICAgKiA8ZXhhbXBsZT5cbiAgICAgKiAgICAgPHNjcmlwdD5cbiAgICAgKiAgICAgICAgICAoYXN5bmMoc2VsZikgPT4gIHtcblxuICAgICAgICAgICAgICAgICAgICBsZXQgaW5wdXQgPSBhd2FpdCBzZWxmLndhaXRSZWYoXCJpbnB1dDFcIik7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUubG9nIChpbnB1dCApO1xuICAgICAgICAgICAgICAgIH0pKEthVHBsLnNlbGYpO1xuICAgICAqICAgICA8L3NjcmlwdD5cbiAgICAgKiAgICAgbGV0IGVsZW0gPSBhd2FpdCBzZWxmLndhaXRSZWYoXCJpbnB1dDFcIilcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0gbmFtZVxuICAgICAqIEByZXR1cm4ge1Byb21pc2V9XG4gICAgICovXG4gICAgd2FpdFJlZihuYW1lKSB7XG4gICAgICAgIGlmICh0eXBlb2YgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgdmFyIHJlc29sdmVyO1xuICAgICAgICAgICAgbGV0IHAgPSBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcbiAgICAgICAgICAgICAgICByZXNvbHZlciA9IHJlc29sdmVcbiAgICAgICAgICAgIH0pO1xuICAgICAgICAgICAgcC5yZXNvbHZlID0gZnVuY3Rpb24gKHZhbHVlKSB7XG4gICAgICAgICAgICAgICAgcmVzb2x2ZXIodmFsdWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9IHA7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXR1cm4gaW1tZWRpYXRlIGlmIHJlZmVyZW5jZSBhbHJlYWR5IGV4aXN0aW5nXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy4kc2NvcGUuJHJlZltuYW1lXSk7XG4gICAgfVxuXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHNlbGYgcmVmZXJlbmNlIChzZWU6IEthVHBsLnNlbGYpXG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIEthVHBsLnByb3RvdHlwZS5zZWxmID0gdGhpcztcblxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgfVxuXG5cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUgPT09IFwidW5kZWZpbmVkXCIpXG4gICAgICAgICAgICAkc2NvcGUgPSB0aGlzLiRzY29wZTtcbiAgICAgICAgdGhpcy5fbG9nKFwicmVuZGVyKCRzY29wZT0gXCIsICRzY29wZSwgXCIpXCIpO1xuICAgICAgICB0aGlzLl9pbml0KCk7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gdHJ1ZTtcbiAgICAgICAgZm9yKGxldCBjZSBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGNlLCAkc2NvcGUpO1xuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=