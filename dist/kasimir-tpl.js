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

        if (refPromise !== null && typeof refPromise !== "undefined" && typeof refPromise.resolve === "function") {
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

        // Store ref/on/fn outside to allow setting $scope without overwriting them
        this._refs = {};
        this._on = {};
        this._fn = {};
        this._scope = {"$ref":this._refs, "$on": this._on, "$fn": this._fn};

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
        this._runTriggerFunction(this.$on.onBeforeDisconnect);
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

        // Set immutable data
        this._scope.$ref = this._refs;
        this._scope.$on = this._on;
        this._scope.$fn = this._fn;

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
                // Return direct link to immutable data
                switch (key) {
                    case "$ref":
                        return this._refs;
                    case "$on":
                        return this._on;
                    case "$fn":
                        return this._fn;
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
     * Execute custom function on event
     *
     * @return {{
     *      onAfterRender: (function($scope): void),
     *      onAfterFirstRender: (function($scope): void)
     *      onBeforeDisconnect: (function($scope): void)
     *      }}
     */
    get $on () {
        return this.$scope.$on;
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
     * let $scope = KaTpl.self.scopeInit({someData: []});
     * </example>
     *
     * @param {{$fn:{}, $on:{}}} $scope
     * @return {Proxy<{}>}
     */
    scopeInit($scope) {
        if (typeof $scope.$fn !== "undefined")
            this._fn = $scope.$fn;
        if (typeof $scope.$on !== "undefined")
            this._on = $scope.$on;

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
            };
            this.$scope.$ref[name] = p;
            return p;
        }
        // Return immediate if reference already existing
        return Promise.resolve(this.$scope.$ref[name]);
    }

    /**
     * Verify if this is the first render attempt
     *
     * @return {boolean} True if first render
     * @private
     */
    _init() {
        if (this._els !== null)
            return false;
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
        return true;
    }


    _runTriggerFunction(fn) {
        if (typeof fn === "function")
            fn($scope, this);
    }


    render($scope) {
        if (typeof $scope === "undefined")
            $scope = this.$scope;
        this._log("render($scope= ", $scope, ")");
        let isFirstRender = this._init();
        this._isRendering = true;
        for(let ce of this._els) {
            this.renderRecursive(ce, $scope);
        }

        // Execute $on callbacks
        if (isFirstRender) {
            this._runTriggerFunction(this.$on.onAfterFirstRender)
        }
        this._runTriggerFunction(this.$on.onAfterRender);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gX19zY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgX19zY29wZSwgZSwgX19yZWZzKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gX19zY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gX19zY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBzY29wZSB3YXMgY2xvbmVkLCB0aGUgb3JpZ2luYWwgd2lsbCBiZSBpbiAkc2NvcGUuIFRoaXMgaXMgaW1wb3J0YW50IHdoZW5cbiAgICAgICAgLy8gVXNpbmcgZXZlbnRzIFtvbi5jbGlja10sIGUuZy5cbiAgICAgICAgaWYgKHR5cGVvZiBfX3Njb3BlLiRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgciArPSBcInZhciAkc2NvcGUgPSBfX3Njb3BlO1wiO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChyICsgc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJjYW5ub3QgZXZhbCgpIHN0bXQ6ICdcIiArIHN0bXQgKyBcIic6IFwiICsgZXggKyBcIiBvbiBlbGVtZW50IFwiLCBlLCBcIihjb250ZXh0OlwiLCBfX3Njb3BlLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcImV2YWwoJ1wiICsgc3RtdCArIFwiJykgZmFpbGVkOiBcIiArIGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHN0cmluZyB0byBiZSBldmFsKCknZWQgcmVnaXN0ZXJpbmdcbiAgICAgKiBhbGwgdGhlIHZhcmlhYmxlcyBpbiBzY29wZSB0byBtZXRob2QgY29udGV4dFxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RvclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKlxuICAgICAqL1xuICAgIHNjb3BlRXZhbCgkc2NvcGUsIHNlbGVjdG9yLCBlbGVtKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICB2YXIgX192YWwgPSBudWxsO1xuICAgICAgICBsZXQgcyA9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIC8vY29uc29sZS5sb2cocik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBldmFsKHIgKyBzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgc2NvcGVFdmFsKCcke3N9JykgZmFpbGVkOiAke2V9IG9uYCwgZWxlbSk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCByZWZQcm9taXNlID0gbnVsbDtcblxuICAgICAgICAvLyBSZWdpc3RlciByZWZlcmVuY2VzXG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgbm9kZS5oYXNBdHRyaWJ1dGUoXCIqcmVmXCIpKSB7XG4gICAgICAgICAgICBsZXQgcmVmbmFtZSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKnJlZlwiKTtcbiAgICAgICAgICAgIHJlZlByb21pc2UgPSAkc2NvcGUuJHJlZltyZWZuYW1lXTtcbiAgICAgICAgICAgICRzY29wZS4kcmVmW3JlZm5hbWVdID0gbm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGlkIG9mIGNsb25lZCBub2RlXG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgbm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWRcIikpIHtcbiAgICAgICAgICAgIG5vZGUuaWQgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoJHNjb3BlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlZlByb21pc2UgIT09IG51bGwgJiYgdHlwZW9mIHJlZlByb21pc2UgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIHJlZlByb21pc2UucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIHByb21pc2UgcmVnaXN0ZXJlZCB3aXRoIHdhaXRSZWYoKVxuICAgICAgICAgICAgcmVmUHJvbWlzZS5yZXNvbHZlKG5vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZU5vZGVzKCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgZWwuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnRFbGVtZW50ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZSBhbmQgYXBwZW5kIGFsbCBlbGVtZW50cyBpblxuICAgICAqIGNvbnRlbnQgb2YgdGVtcGxhdGUgdG8gdGhlIG5leHQgc2libGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBzaWJsaW5nXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIF9hcHBlbmRFbGVtZW50c1RvUGFyZW50KHNpYmxpbmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzaWJsaW5nID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgbGV0IGNuID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgICAgIGZvciAobGV0IGNlbCBvZiBjbi5jaGlsZHJlbikge1xuICAgICAgICAgICAgY2VsLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS50YWdOYW1lID09PSBcIlNDUklQVFwiKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBEb24ndCBwYXJzZSBiZXdlZW4gPHNjcmlwdD48L3NjcmlwdD4gdGFnc1xuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImthLWxvb3BcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuICAgICAgICAgICAgbGV0IG1hID0gYXR0ci5tYXRjaCgvbGV0XFxzKyhcXFMqKVxccysoaW58b2Z8cmVwZWF0KVxccysoXFxTKikoXFxzK2luZGV4YnlcXHMrKFxcUyopKT8vKTtcbiAgICAgICAgICAgIGlmIChtYSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9ybW9kZVwiLCBtYVsyXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgbWFbM10pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZGF0YVwiLCBtYVsxXSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYVs1XSAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JpZHhcIiwgbWFbNV0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JldmFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZXZhbFwiLCBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JldmFsXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IFwiQ2Fubm90IHBhcnNlICpmb3I9J1wiICsgYXR0ciArIFwiJyBmb3IgZWxlbWVudCBcIiArIG5vZGUub3V0ZXJIVE1MO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHJ1bnMgYWZ0ZXIgKmZvciAodG8gZmlsdGVyIGZvciB2YWx1ZXMpXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGt0Q2xhc3NlcyA9IG51bGw7XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuICAgICAgICBsZXQgZXZlbnRzID0ge307XG4gICAgICAgIGxldCBzdHlsZXMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXRbMV0gPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrdENsYXNzZXMgPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwib25cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c1tzcGxpdFsxXV0gPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3R5bGVcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCB8fCBrdENsYXNzZXMgIT09IG51bGwgfHwgT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwIHx8IHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cblxuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChzdHlsZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtc3R5bGVzXCIsIFwie1wiICsgc3R5bGVzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoa3RDbGFzc2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jbHVkZSBbY2xhc3NsaXN0Ll09XCJ7Y2xhc3M6IGNvbmR9XCJcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBrdENsYXNzZXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LW9uXCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50cykpO1xuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG5cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSIsIi8qKlxuICpcbiAqIEByZXR1cm4gS2FUcGxcbiAqL1xuZnVuY3Rpb24ga2FfdHBsKHNlbGVjdG9yKSB7XG4gICAgaWYgKHNlbGVjdG9yIGluc3RhbmNlb2YgS2FUcGwpXG4gICAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICBsZXQgZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNlbGVjdG9yKTtcbiAgICBpZiAoZWxlbSBpbnN0YW5jZW9mIEthVHBsKSB7XG4gICAgICAgIHJldHVybiBlbGVtO1xuICAgIH1cbiAgICB0aHJvdyBgU2VsZWN0b3IgJyR7c2VsZWN0b3J9JyBpcyBub3QgYSA8dGVtcGxhdGUgaXM9XCJrYS10cGxcIj4gZWxlbWVudGA7XG59XG5cblxuXG52YXIgS1RfRk4gPSB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3QtY2xhc3Nlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LnJlbW92ZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LXN0eWxlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgc3R5bGVzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBzdHlsZU5hbWUgaW4gc3R5bGVzKSB7XG4gICAgICAgICAgICBpZiAoICEgc3R5bGVzLmhhc093blByb3BlcnR5KHN0eWxlTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoc3R5bGVzW3N0eWxlTmFtZV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnN0eWxlLnJlbW92ZVByb3BlcnR5KHN0eWxlTmFtZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUuc2V0UHJvcGVydHkoc3R5bGVOYW1lLCBzdHlsZXNbc3R5bGVOYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCAmJiBjbGFzc2VzW2NsYXNzTmFtZV0gIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnJlbW92ZUF0dHJpYnV0ZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBcImt0LW9uXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsICRzY29wZSkge1xuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvLyBDbG9uZSB0aGUgZmlyc3QgbGF5ZXIgb2YgdGhlIHNjb3BlIHNvIGl0IGNhbiBiZSBldmFsdWF0ZWQgb24gZXZlbnRcbiAgICAgICAgbGV0IHNhdmVTY29wZSA9IHsuLi4kc2NvcGV9O1xuICAgICAgICBzYXZlU2NvcGUuJHNjb3BlID0gJHNjb3BlO1xuICAgICAgICAvL3NhdmVTY29wZS4kcmVmID0gJHNjb3BlLiRyZWY7XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3Jtb2RlICE9PSBcInJlcGVhdFwiKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBJbnZhbGlkIGZvclNlbGVjdD1cIiR7X2Ffc2VsfVwiIHJldHVybmVkOmAsIHNlbCwgXCJvbiBjb250ZXh0XCIsIGNvbnRleHQsIFwiKEVsZW1lbnQ6IFwiLCB0aGlzLCBcIilcIik7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvclNlbGVjdCBzZWxlY3Rvci4gc2VlIHdhcmluZy5cIlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8ICh0eXBlb2Ygc2VsW1N5bWJvbC5pdGVyYXRvcl0gIT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2Ygc2VsICE9PSAnb2JqZWN0JykgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9nKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgYSBudW1iZXIuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIGEgbnVtYmVyLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX29yaWdTaWJsaW5nID09PSBmYWxzZSlcbiAgICAgICAgICAgIHRoaXMuX29yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuXG4gICAgICAgIGxldCBuID0gMDtcbiAgICAgICAgc3dpdGNoICh0aGlzLl9hdHRycy5mb3Jtb2RlKSB7XG4gICAgICAgICAgICBjYXNlIFwiaW5cIjpcbiAgICAgICAgICAgICAgICBuID0gMDtcbiAgICAgICAgICAgICAgICBmb3IobGV0IGkgaW4gc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IGk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwib2ZcIjpcbiAgICAgICAgICAgICAgICBuID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpIG9mIHNlbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IGk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwicmVwZWF0XCI6XG4gICAgICAgICAgICAgICAgZm9yIChuPTA7IG4gPCBzZWw7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3IgdHlwZSAnXCIgKyB0aGlzLl9hdHRycy5mb3Jtb2RlICsgXCInIGluIFwiIC4gdGhpcy5vdXRlckhUTUw7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IG47IHNlbC5sZW5ndGggPCB0aGlzLl9lbHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLl9lbHMucG9wKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIGVsZW0ubm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyTm9kZS5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICAgICAgY3VyTm9kZS5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWxvb3BcIiwgS2FMb29wLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsLFxuICAgICAgICAgICAgXCJub2RlYm91bmNlXCI6IGZhbHNlXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIFN0b3JlIHJlZi9vbi9mbiBvdXRzaWRlIHRvIGFsbG93IHNldHRpbmcgJHNjb3BlIHdpdGhvdXQgb3ZlcndyaXRpbmcgdGhlbVxuICAgICAgICB0aGlzLl9yZWZzID0ge307XG4gICAgICAgIHRoaXMuX29uID0ge307XG4gICAgICAgIHRoaXMuX2ZuID0ge307XG4gICAgICAgIHRoaXMuX3Njb3BlID0ge1wiJHJlZlwiOnRoaXMuX3JlZnMsIFwiJG9uXCI6IHRoaXMuX29uLCBcIiRmblwiOiB0aGlzLl9mbn07XG5cbiAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2hhbmRsZXIgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlciB0byB0aGUgY3VycmVudCB0ZW1wbGF0ZSAoc2hvdWxkIGJlIHVzZWQgYnkgPHNjcmlwdD4gaW5zaWRlIGEgdGVtcGxhdGUgdG8gcmVmZXJlbmNlIHRoZVxuICAgICAqIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIEB0eXBlIHtLYVRwbH1cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0IHNlbGYoKSB7XG4gICAgICAgIHJldHVybiBLYVRwbC5wcm90b3R5cGUuc2VsZjtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25CZWZvcmVEaXNjb25uZWN0KTtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwiY29ubmVjdGVkQ2FsbGJhY2soKVwiLCB0aGlzKTtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIilcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhcImF1dG9zdGFydDogX2luaXQoKVwiLCBcImRvY3VtZW50LnJlYWR5U3RhdGU6IFwiLCBkb2N1bWVudC5yZWFkeVN0YXRlKTtcblxuICAgICAgICAgICAgbGV0IGluaXQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICAgICAgICAgIGlmIChhdXRvID09PSBcIlwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBldmFsKGF1dG8pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuXG4gICAgICAgIC8vIFNldCBpbW11dGFibGUgZGF0YVxuICAgICAgICB0aGlzLl9zY29wZS4kcmVmID0gdGhpcy5fcmVmcztcbiAgICAgICAgdGhpcy5fc2NvcGUuJG9uID0gdGhpcy5fb247XG4gICAgICAgIHRoaXMuX3Njb3BlLiRmbiA9IHRoaXMuX2ZuO1xuXG4gICAgICAgIC8vIFJlbmRlciBvbmx5IGlmIGRvbSBhdmFpbGFibGUgKGFsbG93IDxzY3JpcHQ+IGluc2lkZSB0ZW1wbGF0ZSB0byBzZXQgc2NvcGUgYmVmb3JlIGZpcnN0IHJlbmRlcmluZ1xuICAgICAgICBpZiAoICEgdGhpcy5faXNJbml0aWFsaXppbmcpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSk7XG4gICAgfVxuXG4gICAgZ2V0ICRzY29wZSgpIHtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSB7XG4gICAgICAgICAgICBzZXQ6ICh0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSwgcmVjZWl2ZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nIChcInNldDpcIiwgdGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCB1cGRhdGUgcHJveHkgZHVyaW5nIHJlbmRlcmluZyAocmVjdXJzaW9uKVxuICAgICAgICAgICAgICAgIGlmICggISB0aGlzLl9pc1JlbmRlcmluZykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMubm9kZWJvdW5jZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERlZmF1bHQgYmVoYXZpb3VyOiBEZWJvdW5jZTogU28geW91IGNhbiBkbyBtdWx0aXBsZSAkc2NvcGUgdXBkYXRlZCB3aXRoIHJlbmRpbmcgb25seSBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fX2RlYm91bmNlVGltZW91dCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fX2RlYm91bmNlVGltZW91dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9fZGVib3VuY2VUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldDogKHRhcmdldCwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gUmV0dXJuIGRpcmVjdCBsaW5rIHRvIGltbXV0YWJsZSBkYXRhXG4gICAgICAgICAgICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIiRyZWZcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZzO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiJG9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fb247XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCIkZm5cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9mbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiICYmIHRhcmdldFtrZXldICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZSBjdXN0b20gZnVuY3Rpb25zIGZyb20gb3V0c2lkZSB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIDxleGFtcGxlPlxuICAgICAqICAgICBrYV90cGwoXCJ0cGwxXCIpLiRmbi5kb1NvbWV0aGluZygpO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge3tjdXN0b21GbjogKGZ1bmN0aW9uKCopOiBzdHJpbmcpfXx7fX1cbiAgICAgKi9cbiAgICBnZXQgJGZuICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlLiRmbjtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgY3VzdG9tIGZ1bmN0aW9uIG9uIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHt7XG4gICAgICogICAgICBvbkFmdGVyUmVuZGVyOiAoZnVuY3Rpb24oJHNjb3BlKTogdm9pZCksXG4gICAgICogICAgICBvbkFmdGVyRmlyc3RSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKVxuICAgICAqICAgICAgb25CZWZvcmVEaXNjb25uZWN0OiAoZnVuY3Rpb24oJHNjb3BlKTogdm9pZClcbiAgICAgKiAgICAgIH19XG4gICAgICovXG4gICAgZ2V0ICRvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZS4kb247XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBzY29wZS4gV2lsbCByZXR1cm4gdGhlIHByb3hpZWQgc2NvcGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogVGhlIHByb3h5IGtlZXBzIHRyYWNrIGFib3V0IGNoYW5nZXMgdG8gJHNjb3BlIGFuZCByZXJlbmRlcnMgdGhlXG4gICAgICogZGF0YSB0aGVuLlxuICAgICAqXG4gICAgICogU28geW91IGNhbiB1c2UgdGhlIHJldHVybiB2YWx1ZSB3aXRoaW4gdGhlIHNjb3BlIGRlZmluaXRpb24gaXRzZWxmLlxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogbGV0ICRzY29wZSA9IEthVHBsLnNlbGYuc2NvcGVJbml0KHtzb21lRGF0YTogW119KTtcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3skZm46e30sICRvbjp7fX19ICRzY29wZVxuICAgICAqIEByZXR1cm4ge1Byb3h5PHt9Pn1cbiAgICAgKi9cbiAgICBzY29wZUluaXQoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgJHNjb3BlLiRmbiAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHRoaXMuX2ZuID0gJHNjb3BlLiRmbjtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUuJG9uICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgdGhpcy5fb24gPSAkc2NvcGUuJG9uO1xuXG4gICAgICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZTsgLy8gPC0gUXVlcnkgc2NvcGUgb3ZlciBnZXR0ZXIgdG8gcmVjZWl2ZSBwcm94eVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogV2FpdCBmb3IgYSByZWZlcmVuY2UgdG8gYmUgcmVuZGVyZWRcbiAgICAgKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaXMgcmVzb2x2ZWQgb25jZSB0aGUgUmVmZXJlbmNlZFxuICAgICAqIEVsZW1lbnQgKGNvbnRhaW5pbmcgKnJlZiBhdHRyaWJ1dGUpIGluIHRlbXBsYXRlIGFuZCBhbGwgaXRzXG4gICAgICogY2hpbGQgZWxlbWVudHMgd2FzIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogSWYgdGhlIGVsZW1lbnRcbiAgICAgKlxuICAgICAqIDxleGFtcGxlPlxuICAgICAqICAgICA8c2NyaXB0PlxuICAgICAqICAgICAgICAgIChhc3luYyhzZWxmKSA9PiAge1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBpbnB1dCA9IGF3YWl0IHNlbGYud2FpdFJlZihcImlucHV0MVwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cgKGlucHV0ICk7XG4gICAgICAgICAgICAgICAgfSkoS2FUcGwuc2VsZik7XG4gICAgICogICAgIDwvc2NyaXB0PlxuICAgICAqICAgICBsZXQgZWxlbSA9IGF3YWl0IHNlbGYud2FpdFJlZihcImlucHV0MVwiKVxuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBuYW1lXG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB3YWl0UmVmKG5hbWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLiRzY29wZS4kcmVmW25hbWVdID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICB2YXIgcmVzb2x2ZXI7XG4gICAgICAgICAgICBsZXQgcCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmVyID0gcmVzb2x2ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwLnJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlcih2YWx1ZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9IHA7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXR1cm4gaW1tZWRpYXRlIGlmIHJlZmVyZW5jZSBhbHJlYWR5IGV4aXN0aW5nXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy4kc2NvcGUuJHJlZltuYW1lXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVmVyaWZ5IGlmIHRoaXMgaXMgdGhlIGZpcnN0IHJlbmRlciBhdHRlbXB0XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGZpcnN0IHJlbmRlclxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHNlbGYgcmVmZXJlbmNlIChzZWU6IEthVHBsLnNlbGYpXG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIEthVHBsLnByb3RvdHlwZS5zZWxmID0gdGhpcztcblxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuXG4gICAgX3J1blRyaWdnZXJGdW5jdGlvbihmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICBmbigkc2NvcGUsIHRoaXMpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBpZiAodHlwZW9mICRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICRzY29wZSA9IHRoaXMuJHNjb3BlO1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIGxldCBpc0ZpcnN0UmVuZGVyID0gdGhpcy5faW5pdCgpO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IHRydWU7XG4gICAgICAgIGZvcihsZXQgY2Ugb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEV4ZWN1dGUgJG9uIGNhbGxiYWNrc1xuICAgICAgICBpZiAoaXNGaXJzdFJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQWZ0ZXJGaXJzdFJlbmRlcilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25BZnRlclJlbmRlcik7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbImNvcmUva3QtaGVscGVyLmpzIiwiY29yZS9rdC1yZW5kZXJhYmxlLmpzIiwiY29yZS9LdFRlbXBsYXRlUGFyc2VyLmpzIiwiZnVuY3Rpb25zLmpzIiwia2EtaW5jbHVkZS5qcyIsImthLWxvb3AuanMiLCJrYS10cGwuanMiLCJrYS12YWwuanMiLCJrdC1pZi5qcyIsImt0LW1haW50YWluLmpzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM1RUE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ3hJQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM3S0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzNGQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FDdkdBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQzdIQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQ25TQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUM5REE7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQy9CQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0EiLCJmaWxlIjoia2FzaW1pci10cGwuanMiLCJzb3VyY2VzQ29udGVudCI6WyJcbmNsYXNzIEt0SGVscGVyIHtcblxuXG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3N0cmluZ30gc3RtdFxuICAgICAqIEBwYXJhbSB7Y29udGV4dH0gX19zY29wZVxuICAgICAqIEBwYXJhbSB7SFRNTEVsZW1lbnR9IGVcbiAgICAgKiBAcmV0dXJuIHthbnl9XG4gICAgICovXG4gICAga2V2YWwoc3RtdCwgX19zY29wZSwgZSwgX19yZWZzKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gX19zY29wZSkge1xuICAgICAgICAgICAgaWYgKHJlc2VydmVkLmluZGV4T2YoX19uYW1lKSAhPT0gLTEpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICByICs9IGB2YXIgJHtfX25hbWV9ID0gX19zY29wZVsnJHtfX25hbWV9J107YFxuICAgICAgICB9XG4gICAgICAgIC8vIElmIHRoZSBzY29wZSB3YXMgY2xvbmVkLCB0aGUgb3JpZ2luYWwgd2lsbCBiZSBpbiAkc2NvcGUuIFRoaXMgaXMgaW1wb3J0YW50IHdoZW5cbiAgICAgICAgLy8gVXNpbmcgZXZlbnRzIFtvbi5jbGlja10sIGUuZy5cbiAgICAgICAgaWYgKHR5cGVvZiBfX3Njb3BlLiRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIikge1xuICAgICAgICAgICAgciArPSBcInZhciAkc2NvcGUgPSBfX3Njb3BlO1wiO1xuICAgICAgICB9XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICByZXR1cm4gZXZhbChyICsgc3RtdClcbiAgICAgICAgfSBjYXRjaCAoZXgpIHtcbiAgICAgICAgICAgIGNvbnNvbGUuZXJyb3IoXCJjYW5ub3QgZXZhbCgpIHN0bXQ6ICdcIiArIHN0bXQgKyBcIic6IFwiICsgZXggKyBcIiBvbiBlbGVtZW50IFwiLCBlLCBcIihjb250ZXh0OlwiLCBfX3Njb3BlLCBcIilcIik7XG4gICAgICAgICAgICB0aHJvdyBcImV2YWwoJ1wiICsgc3RtdCArIFwiJykgZmFpbGVkOiBcIiArIGV4O1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogUmV0dXJucyBhIHN0cmluZyB0byBiZSBldmFsKCknZWQgcmVnaXN0ZXJpbmdcbiAgICAgKiBhbGwgdGhlIHZhcmlhYmxlcyBpbiBzY29wZSB0byBtZXRob2QgY29udGV4dFxuICAgICAqXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSBzZWxlY3RvclxuICAgICAqIEByZXR1cm4ge3N0cmluZ31cbiAgICAgKlxuICAgICAqL1xuICAgIHNjb3BlRXZhbCgkc2NvcGUsIHNlbGVjdG9yLCBlbGVtKSB7XG4gICAgICAgIGNvbnN0IHJlc2VydmVkID0gW1widmFyXCIsIFwibnVsbFwiLCBcImxldFwiLCBcImNvbnN0XCIsIFwiZnVuY3Rpb25cIiwgXCJjbGFzc1wiLCBcImluXCIsIFwib2ZcIiwgXCJmb3JcIiwgXCJ0cnVlXCIsIFwiZmFsc2VcIiwgXCJhd2FpdFwiXTtcbiAgICAgICAgbGV0IHIgPSBcIlwiO1xuICAgICAgICBmb3IgKGxldCBfX25hbWUgaW4gJHNjb3BlKSB7XG4gICAgICAgICAgICBpZiAocmVzZXJ2ZWQuaW5kZXhPZihfX25hbWUpICE9PSAtMSlcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIHIgKz0gYHZhciAke19fbmFtZX0gPSAkc2NvcGVbJyR7X19uYW1lfSddO2BcbiAgICAgICAgfVxuICAgICAgICB2YXIgX192YWwgPSBudWxsO1xuICAgICAgICBsZXQgcyA9IGBfX3ZhbCA9ICR7c2VsZWN0b3J9O2A7XG4gICAgICAgIC8vY29uc29sZS5sb2cocik7XG4gICAgICAgIHRyeSB7XG4gICAgICAgICAgICBldmFsKHIgKyBzKTtcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgY29uc29sZS5lcnJvcihgc2NvcGVFdmFsKCcke3N9JykgZmFpbGVkOiAke2V9IG9uYCwgZWxlbSk7XG4gICAgICAgICAgICB0aHJvdyBgZXZhbCgnJHtzfScpIGZhaWxlZDogJHtlfWA7XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIF9fdmFsO1xuICAgIH1cblxuICAgIC8qKlxuICAgICAqICBGaW5kIHRoZSBmaXJzdCB3aGl0ZXNwYWNlcyBpbiB0ZXh0IGFuZCByZW1vdmUgdGhlbSBmcm9tIHRoZVxuICAgICAqICBzdGFydCBvZiB0aGUgZm9sbG93aW5nIGxpbmVzLlxuICAgICAqXG4gICAgICogIEBwYXJhbSB7c3RyaW5nfSBzdHJcbiAgICAgKiAgQHJldHVybiB7c3RyaW5nfVxuICAgICAqL1xuICAgIHVuaW5kZW50VGV4dChzdHIpIHtcbiAgICAgICAgbGV0IGkgPSBzdHIubWF0Y2goL1xcbihcXHMqKS9tKVsxXTtcbiAgICAgICAgc3RyID0gc3RyLnJlcGxhY2UobmV3IFJlZ0V4cChgXFxuJHtpfWAsIFwiZ1wiKSwgXCJcXG5cIik7XG4gICAgICAgIHN0ciA9IHN0ci50cmltKCk7XG4gICAgICAgIHJldHVybiBzdHI7XG4gICAgfVxuXG5cbn0iLCJcbnZhciBfS1RfRUxFTUVOVF9JRCA9IDA7XG5cbmNsYXNzIEt0UmVuZGVyYWJsZSBleHRlbmRzIEhUTUxUZW1wbGF0ZUVsZW1lbnQge1xuXG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICAvKipcbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge0t0SGVscGVyfVxuICAgICAgICAgKiBAcHJvdGVjdGVkXG4gICAgICAgICAqL1xuICAgICAgICB0aGlzLl9obHByID0gbmV3IEt0SGVscGVyKCk7XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIEFycmF5IHdpdGggYWxsIG9ic2VydmVkIGVsZW1lbnRzIG9mIHRoaXMgdGVtcGxhdGVcbiAgICAgICAgICpcbiAgICAgICAgICogbnVsbCBpbmRpY2F0ZXMsIHRoZSB0ZW1wbGF0ZSB3YXMgbm90IHlldCByZW5kZXJlZFxuICAgICAgICAgKlxuICAgICAgICAgKiBAdHlwZSB7SFRNTEVsZW1lbnRbXX1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XCJkZWJ1Z1wiOiBmYWxzZX07XG5cbiAgICAgICAgLyoqXG4gICAgICAgICAqIFRoZSBpbnRlcm5hbCBlbGVtZW50IGlkIHRvIGlkZW50aWZ5IHdoaWNoIGVsZW1lbnRzXG4gICAgICAgICAqIHRvIHJlbmRlci5cbiAgICAgICAgICpcbiAgICAgICAgICogQHR5cGUge251bWJlcn1cbiAgICAgICAgICogQHByb3RlY3RlZFxuICAgICAgICAgKi9cbiAgICAgICAgdGhpcy5fa3RJZCA9ICsrX0tUX0VMRU1FTlRfSUQ7XG4gICAgfVxuXG4gICAgYXR0cmlidXRlQ2hhbmdlZENhbGxiYWNrKGF0dHJOYW1lLCBvbGRWYWwsIG5ld1ZhbCkge1xuICAgICAgICB0aGlzLl9hdHRyc1thdHRyTmFtZV0gPSBuZXdWYWw7XG4gICAgfVxuXG4gICAgX2xvZyh2MSwgdjIsIHYzKSB7XG4gICAgICAgIGxldCBhID0gWyB0aGlzLmNvbnN0cnVjdG9yLm5hbWUgKyBcIiNcIiArIHRoaXMuaWQgKyBcIltcIiArIHRoaXMuX2t0SWQgKyBcIl06XCJdO1xuXG4gICAgICAgIGZvciAobGV0IGUgb2YgYXJndW1lbnRzKVxuICAgICAgICAgICAgYS5wdXNoKGUpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5kZWJ1ZyAhPT0gZmFsc2UpXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhKTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIFdhbGsgdGhyb3VnaCBhbGwgZWxlbWVudHMgYW5kIHRyeSB0byByZW5kZXIgdGhlbS5cbiAgICAgKlxuICAgICAqIGlmIGEgZWxlbWVudCBoYXMgdGhlIF9rYU1iIChtYWludGFpbmVkIGJ5KSBwcm9wZXJ0eSBzZXQsXG4gICAgICogY2hlY2sgaWYgaXQgZXF1YWxzIHRoaXMuX2thSWQgKHRoZSBlbGVtZW50IGlkKS4gSWYgbm90LFxuICAgICAqIHNraXAgdGhpcyBub2RlLlxuICAgICAqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBub2RlXG4gICAgICogQHBhcmFtIHtvYmplY3R9ICRzY29wZVxuICAgICAqL1xuICAgIHJlbmRlclJlY3Vyc2l2ZShub2RlLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKG5vZGUuaGFzT3duUHJvcGVydHkoXCJfa2FNYlwiKSAmJiBub2RlLl9rYU1iICE9PSB0aGlzLl9rdElkKVxuICAgICAgICAgICAgcmV0dXJuO1xuXG4gICAgICAgIGxldCByZWZQcm9taXNlID0gbnVsbDtcblxuICAgICAgICAvLyBSZWdpc3RlciByZWZlcmVuY2VzXG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgbm9kZS5oYXNBdHRyaWJ1dGUoXCIqcmVmXCIpKSB7XG4gICAgICAgICAgICBsZXQgcmVmbmFtZSA9IG5vZGUuZ2V0QXR0cmlidXRlKFwiKnJlZlwiKTtcbiAgICAgICAgICAgIHJlZlByb21pc2UgPSAkc2NvcGUuJHJlZltyZWZuYW1lXTtcbiAgICAgICAgICAgICRzY29wZS4kcmVmW3JlZm5hbWVdID0gbm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIFJlZ2lzdGVyIGlkIG9mIGNsb25lZCBub2RlXG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgSFRNTEVsZW1lbnQgJiYgbm9kZS5oYXNBdHRyaWJ1dGUoXCIqaWRcIikpIHtcbiAgICAgICAgICAgIG5vZGUuaWQgPSBub2RlLmdldEF0dHJpYnV0ZShcIippZFwiKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5yZW5kZXIgPT09IFwiZnVuY3Rpb25cIikge1xuICAgICAgICAgICAgbm9kZS5yZW5kZXIoJHNjb3BlKTtcbiAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvcihsZXQgY3VyTm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmIChub2RlLmt0U2tpcFJlbmRlciA9PT0gdHJ1ZSlcbiAgICAgICAgICAgICAgICByZXR1cm47XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjdXJOb2RlLCAkc2NvcGUpO1xuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHJlZlByb21pc2UgIT09IG51bGwgJiYgdHlwZW9mIHJlZlByb21pc2UgIT09IFwidW5kZWZpbmVkXCIgJiYgdHlwZW9mIHJlZlByb21pc2UucmVzb2x2ZSA9PT0gXCJmdW5jdGlvblwiKSB7XG4gICAgICAgICAgICAvLyBSZXNvbHZlIHByb21pc2UgcmVnaXN0ZXJlZCB3aXRoIHdhaXRSZWYoKVxuICAgICAgICAgICAgcmVmUHJvbWlzZS5yZXNvbHZlKG5vZGUpO1xuICAgICAgICB9XG4gICAgfVxuXG4gICAgX3JlbW92ZU5vZGVzKCkge1xuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKVxuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgZWwuX3JlbW92ZU5vZGVzID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICAgICAgZWwuX3JlbW92ZU5vZGVzKCk7XG4gICAgICAgICAgICBpZiAodGhpcy5wYXJlbnRFbGVtZW50ICE9PSBudWxsKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyZW50RWxlbWVudC5yZW1vdmVDaGlsZChlbCk7XG4gICAgICAgIH1cbiAgICAgICAgdGhpcy5fZWxzID0gbnVsbDtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBDbG9uZSBhbmQgYXBwZW5kIGFsbCBlbGVtZW50cyBpblxuICAgICAqIGNvbnRlbnQgb2YgdGVtcGxhdGUgdG8gdGhlIG5leHQgc2libGluZy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBzaWJsaW5nXG4gICAgICogQHByb3RlY3RlZFxuICAgICAqL1xuICAgIF9hcHBlbmRFbGVtZW50c1RvUGFyZW50KHNpYmxpbmcpIHtcbiAgICAgICAgaWYgKHR5cGVvZiBzaWJsaW5nID09PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgbGV0IGNuID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgdGhpcy5fZWxzID0gW107XG4gICAgICAgIGZvciAobGV0IGNlbCBvZiBjbi5jaGlsZHJlbikge1xuICAgICAgICAgICAgY2VsLl9rYU1iID0gdGhpcy5fa3RJZDtcbiAgICAgICAgICAgIHRoaXMuX2Vscy5wdXNoKGNlbCk7XG4gICAgICAgIH1cblxuICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKGNuLCBzaWJsaW5nKTtcblxuICAgIH1cblxufVxuXG5cblxuIiwiXG5cbmNsYXNzIEt0VGVtcGxhdGVQYXJzZXIge1xuXG5cbiAgICAvKipcbiAgICAgKlxuICAgICAqIEBwYXJhbSB0ZXh0XG4gICAgICogQHBhcmFtIHtEb2N1bWVudEZyYWdtZW50fSBmcmFnbWVudFxuICAgICAqIEByZXR1cm4ge251bGx9XG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfcGFyc2VUZXh0Tm9kZSAodGV4dCwgZnJhZ21lbnQpIHtcbiAgICAgICAgbGV0IHNwbGl0ID0gdGV4dC5zcGxpdCgvKFxce1xce3xcXH1cXH0pLyk7XG4gICAgICAgIHdoaWxlKHNwbGl0Lmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgIGZyYWdtZW50LmFwcGVuZENoaWxkKG5ldyBUZXh0KHNwbGl0LnNoaWZ0KCkpKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDApXG4gICAgICAgICAgICAgICAgYnJlYWs7XG5cbiAgICAgICAgICAgIHNwbGl0LnNoaWZ0KCk7XG4gICAgICAgICAgICBsZXQgdmFsID0gbmV3IEthVmFsKCk7XG4gICAgICAgICAgICB2YWwuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBzcGxpdC5zaGlmdCgpLnRyaW0oKSk7XG4gICAgICAgICAgICBzcGxpdC5zaGlmdCgpO1xuICAgICAgICAgICAgZnJhZ21lbnQuYXBwZW5kQ2hpbGQodmFsKTtcbiAgICAgICAgfVxuICAgIH1cblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gbm9kZVxuICAgICAqL1xuICAgIHBhcnNlUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgLy9jb25zb2xlLmxvZyhcIltrYS10cGxdIHBhcnNlUmVjdXJzaXZlKFwiLCBub2RlLCBcIilcIik7XG4gICAgICAgIGlmIChub2RlIGluc3RhbmNlb2YgRG9jdW1lbnRGcmFnbWVudCkge1xuICAgICAgICAgICAgZm9yIChsZXQgbiBvZiBub2RlLmNoaWxkcmVuKVxuICAgICAgICAgICAgICAgIHRoaXMucGFyc2VSZWN1cnNpdmUobik7XG4gICAgICAgICAgICByZXR1cm47XG4gICAgICAgIH1cblxuICAgICAgICBpZiAobm9kZS50YWdOYW1lID09PSBcIlNDUklQVFwiKVxuICAgICAgICAgICAgcmV0dXJuOyAvLyBEb24ndCBwYXJzZSBiZXdlZW4gPHNjcmlwdD48L3NjcmlwdD4gdGFnc1xuXG4gICAgICAgIGlmICh0eXBlb2Ygbm9kZS5nZXRBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBpZiAobm9kZS5rdFBhcnNlZCA9PT0gdHJ1ZSlcbiAgICAgICAgICAgIHJldHVybjtcblxuICAgICAgICBub2RlLmt0UGFyc2VkID0gdHJ1ZTtcblxuICAgICAgICBmb3IgKGxldCB0ZXh0Tm9kZSBvZiBub2RlLmNoaWxkTm9kZXMpIHtcbiAgICAgICAgICAgIGlmICh0eXBlb2YgdGV4dE5vZGUuZGF0YSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGxldCBmcmFnbWVudCA9IG5ldyBEb2N1bWVudEZyYWdtZW50KCk7XG4gICAgICAgICAgICB0aGlzLl9wYXJzZVRleHROb2RlKHRleHROb2RlLmRhdGEsIGZyYWdtZW50KTtcbiAgICAgICAgICAgIHRleHROb2RlLnJlcGxhY2VXaXRoKGZyYWdtZW50KTtcblxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKG5vZGUuaGFzQXR0cmlidXRlKFwiKmZvclwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImthLWxvb3BcIn0pO1xuICAgICAgICAgICAgbGV0IGF0dHIgPSBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcblxuICAgICAgICAgICAgbGV0IG1hID0gYXR0ci5tYXRjaCgvbGV0XFxzKyhcXFMqKVxccysoaW58b2Z8cmVwZWF0KVxccysoXFxTKikoXFxzK2luZGV4YnlcXHMrKFxcUyopKT8vKTtcbiAgICAgICAgICAgIGlmIChtYSAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9ybW9kZVwiLCBtYVsyXSk7XG4gICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JzZWxlY3RcIiwgbWFbM10pO1xuICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZGF0YVwiLCBtYVsxXSk7XG4gICAgICAgICAgICAgICAgaWYgKHR5cGVvZiBtYVs1XSAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICAgICAgICAgbmV3Tm9kZS5zZXRBdHRyaWJ1dGUoXCJmb3JpZHhcIiwgbWFbNV0pO1xuICAgICAgICAgICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIipmb3JldmFsXCIpKSB7XG4gICAgICAgICAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwiZm9yZXZhbFwiLCBub2RlLmdldEF0dHJpYnV0ZShcIipmb3JldmFsXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIHRocm93IFwiQ2Fubm90IHBhcnNlICpmb3I9J1wiICsgYXR0ciArIFwiJyBmb3IgZWxlbWVudCBcIiArIG5vZGUub3V0ZXJIVE1MO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIElmIHJ1bnMgYWZ0ZXIgKmZvciAodG8gZmlsdGVyIGZvciB2YWx1ZXMpXG4gICAgICAgIGlmIChub2RlLmhhc0F0dHJpYnV0ZShcIippZlwiKSkge1xuICAgICAgICAgICAgbGV0IG5ld05vZGUgPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwidGVtcGxhdGVcIiwge2lzOiBcImt0LWlmXCJ9KTtcbiAgICAgICAgICAgIGxldCBhdHRyID0gbm9kZS5nZXRBdHRyaWJ1dGUoXCIqaWZcIik7XG4gICAgICAgICAgICAvKiBAdmFyIHtIVE1MVGVtcGxhdGVFbGVtZW50fSBuZXdOb2RlICovXG4gICAgICAgICAgICBsZXQgY2xvbmVOb2RlID0gbm9kZS5jbG9uZU5vZGUodHJ1ZSk7XG4gICAgICAgICAgICBuZXdOb2RlLmNvbnRlbnQuYXBwZW5kQ2hpbGQoY2xvbmVOb2RlKTtcbiAgICAgICAgICAgIG5ld05vZGUuc2V0QXR0cmlidXRlKFwic3RtdFwiLCBhdHRyKTtcbiAgICAgICAgICAgIG5vZGUucmVwbGFjZVdpdGgobmV3Tm9kZSk7XG4gICAgICAgICAgICBub2RlID0gY2xvbmVOb2RlO1xuICAgICAgICB9XG5cbiAgICAgICAgbGV0IGNzc0NsYXNzZXMgPSBbXTtcbiAgICAgICAgbGV0IGt0Q2xhc3NlcyA9IG51bGw7XG4gICAgICAgIGxldCBhdHRycyA9IFtdO1xuICAgICAgICBsZXQgZXZlbnRzID0ge307XG4gICAgICAgIGxldCBzdHlsZXMgPSBbXTtcblxuICAgICAgICBsZXQgcmVnZXggPSBuZXcgUmVnRXhwKFwiXlxcXFxbKC4rKVxcXFxdJFwiKTtcbiAgICAgICAgZm9yKGxldCBhdHRyTmFtZSBvZiBub2RlLmdldEF0dHJpYnV0ZU5hbWVzKCkpIHtcblxuICAgICAgICAgICAgbGV0IHJlc3VsdCA9IHJlZ2V4LmV4ZWMoYXR0ck5hbWUpO1xuICAgICAgICAgICAgaWYgKHJlc3VsdCA9PT0gbnVsbClcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcblxuICAgICAgICAgICAgbGV0IHNwbGl0ID0gcmVzdWx0WzFdLnNwbGl0KFwiLlwiKTtcbiAgICAgICAgICAgIGlmIChzcGxpdC5sZW5ndGggPT09IDEpIHtcbiAgICAgICAgICAgICAgICBhdHRycy5wdXNoKGAnJHtzcGxpdFswXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgc3dpdGNoIChzcGxpdFswXSkge1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiY2xhc3NsaXN0XCI6XG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAoc3BsaXRbMV0gPT09IFwiXCIpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBrdENsYXNzZXMgPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAgICAgICAgIGNzc0NsYXNzZXMucHVzaChgJyR7c3BsaXRbMV19JzogYCArIG5vZGUuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwib25cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIGV2ZW50c1tzcGxpdFsxXV0gPSBub2RlLmdldEF0dHJpYnV0ZShhdHRyTmFtZSk7XG4gICAgICAgICAgICAgICAgICAgICAgICBicmVhaztcblxuICAgICAgICAgICAgICAgICAgICBjYXNlIFwic3R5bGVcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHN0eWxlcy5wdXNoKGAnJHtzcGxpdFsxXX0nOiBgICsgbm9kZS5nZXRBdHRyaWJ1dGUoYXR0ck5hbWUpKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICAgICAgICAgIGRlZmF1bHQ6XG4gICAgICAgICAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oXCJJbnZhbGlkIGF0dHJpYnV0ZSAnXCIgKyBhdHRyTmFtZSArIFwiJ1wiKVxuICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGlmIChhdHRycy5sZW5ndGggPiAwIHx8IGNzc0NsYXNzZXMubGVuZ3RoID4gMCB8fCBrdENsYXNzZXMgIT09IG51bGwgfHwgT2JqZWN0LmtleXMoZXZlbnRzKS5sZW5ndGggPiAwIHx8IHN0eWxlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgICAgICBsZXQgbmV3Tm9kZSA9IGRvY3VtZW50LmNyZWF0ZUVsZW1lbnQoXCJ0ZW1wbGF0ZVwiLCB7aXM6IFwia3QtbWFpbnRhaW5cIn0pO1xuICAgICAgICAgICAgLyogQHZhciB7SFRNTFRlbXBsYXRlRWxlbWVudH0gbmV3Tm9kZSAqL1xuICAgICAgICAgICAgbGV0IGNsb25lTm9kZSA9IG5vZGUuY2xvbmVOb2RlKHRydWUpO1xuICAgICAgICAgICAgbmV3Tm9kZS5jb250ZW50LmFwcGVuZENoaWxkKGNsb25lTm9kZSk7XG5cblxuICAgICAgICAgICAgaWYgKGF0dHJzLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LWF0dHJzXCIsIFwie1wiICsgYXR0cnMuam9pbihcIixcIikgKyBcIn1cIik7XG5cbiAgICAgICAgICAgIGlmIChzdHlsZXMubGVuZ3RoID4gMClcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3Qtc3R5bGVzXCIsIFwie1wiICsgc3R5bGVzLmpvaW4oXCIsXCIpICsgXCJ9XCIpO1xuXG4gICAgICAgICAgICBpZiAoa3RDbGFzc2VzICE9PSBudWxsKSB7XG4gICAgICAgICAgICAgICAgLy8gaW5jbHVkZSBbY2xhc3NsaXN0Ll09XCJ7Y2xhc3M6IGNvbmR9XCJcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBrdENsYXNzZXMpO1xuICAgICAgICAgICAgfSBlbHNlIGlmIChjc3NDbGFzc2VzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgICAgICAgICBjbG9uZU5vZGUuc2V0QXR0cmlidXRlKFwia3QtY2xhc3Nlc1wiLCBcIntcIiArIGNzc0NsYXNzZXMuam9pbihcIixcIikgKyBcIn1cIik7XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgICAgIGlmIChPYmplY3Qua2V5cyhldmVudHMpLmxlbmd0aCA+IDApXG4gICAgICAgICAgICAgICAgY2xvbmVOb2RlLnNldEF0dHJpYnV0ZShcImt0LW9uXCIsIEpTT04uc3RyaW5naWZ5KGV2ZW50cykpO1xuXG4gICAgICAgICAgICBub2RlLnJlcGxhY2VXaXRoKG5ld05vZGUpO1xuICAgICAgICAgICAgbm9kZSA9IGNsb25lTm9kZTtcbiAgICAgICAgfVxuXG5cblxuICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIG5vZGUuY2hpbGRyZW4pXG4gICAgICAgICAgICB0aGlzLnBhcnNlUmVjdXJzaXZlKGN1ck5vZGUpO1xuXG5cblxuICAgIH1cblxufSIsIi8qKlxuICpcbiAqIEByZXR1cm4gS2FUcGxcbiAqL1xuZnVuY3Rpb24ga2FfdHBsKHNlbGVjdG9yKSB7XG4gICAgaWYgKHNlbGVjdG9yIGluc3RhbmNlb2YgS2FUcGwpXG4gICAgICAgIHJldHVybiBzZWxlY3RvcjtcbiAgICBsZXQgZWxlbSA9IGRvY3VtZW50LmdldEVsZW1lbnRCeUlkKHNlbGVjdG9yKTtcbiAgICBpZiAoZWxlbSBpbnN0YW5jZW9mIEthVHBsKSB7XG4gICAgICAgIHJldHVybiBlbGVtO1xuICAgIH1cbiAgICB0aHJvdyBgU2VsZWN0b3IgJyR7c2VsZWN0b3J9JyBpcyBub3QgYSA8dGVtcGxhdGUgaXM9XCJrYS10cGxcIj4gZWxlbWVudGA7XG59XG5cblxuXG52YXIgS1RfRk4gPSB7XG4gICAgLyoqXG4gICAgICpcbiAgICAgKiBAcGFyYW0ge0hUTUxFbGVtZW50fSBlbGVtXG4gICAgICogQHBhcmFtIHtzdHJpbmd9IHZhbFxuICAgICAqIEBwYXJhbSBzY29wZVxuICAgICAqL1xuICAgIFwia3QtY2xhc3Nlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgY2xhc3NlcyA9IGt0aGVscGVyLnNjb3BlRXZhbChzY29wZSwgdmFsKTtcbiAgICAgICAgZm9yIChsZXQgY2xhc3NOYW1lIGluIGNsYXNzZXMpIHtcbiAgICAgICAgICAgIGlmICggISBjbGFzc2VzLmhhc093blByb3BlcnR5KGNsYXNzTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoY2xhc3Nlc1tjbGFzc05hbWVdID09PSB0cnVlKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5jbGFzc0xpc3QuYWRkKGNsYXNzTmFtZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uY2xhc3NMaXN0LnJlbW92ZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcblxuICAgIC8qKlxuICAgICAqXG4gICAgICogQHBhcmFtIHtIVE1MRWxlbWVudH0gZWxlbVxuICAgICAqIEBwYXJhbSB7c3RyaW5nfSB2YWxcbiAgICAgKiBAcGFyYW0gc2NvcGVcbiAgICAgKi9cbiAgICBcImt0LXN0eWxlc1wiOiBmdW5jdGlvbihlbGVtLCB2YWwsIHNjb3BlKSB7XG4gICAgICAgIFwidXNlIHN0cmljdFwiO1xuXG4gICAgICAgIGxldCBrdGhlbHBlciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICBsZXQgc3R5bGVzID0ga3RoZWxwZXIuc2NvcGVFdmFsKHNjb3BlLCB2YWwpO1xuICAgICAgICBmb3IgKGxldCBzdHlsZU5hbWUgaW4gc3R5bGVzKSB7XG4gICAgICAgICAgICBpZiAoICEgc3R5bGVzLmhhc093blByb3BlcnR5KHN0eWxlTmFtZSkpXG4gICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICBpZiAoc3R5bGVzW3N0eWxlTmFtZV0gPT09IG51bGwpIHtcbiAgICAgICAgICAgICAgICBlbGVtLnN0eWxlLnJlbW92ZVByb3BlcnR5KHN0eWxlTmFtZSk7XG4gICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGVsZW0uc3R5bGUuc2V0UHJvcGVydHkoc3R5bGVOYW1lLCBzdHlsZXNbc3R5bGVOYW1lXSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9LFxuXG4gICAgXCJrdC1hdHRyc1wiOiBmdW5jdGlvbiAoZWxlbSwgdmFsLCBzY29wZSkge1xuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcbiAgICAgICAgbGV0IGNsYXNzZXMgPSBrdGhlbHBlci5zY29wZUV2YWwoc2NvcGUsIHZhbCk7XG4gICAgICAgIGZvciAobGV0IGNsYXNzTmFtZSBpbiBjbGFzc2VzKSB7XG4gICAgICAgICAgICBpZiAoICEgY2xhc3Nlcy5oYXNPd25Qcm9wZXJ0eShjbGFzc05hbWUpKVxuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgaWYgKGNsYXNzZXNbY2xhc3NOYW1lXSAhPT0gbnVsbCAmJiBjbGFzc2VzW2NsYXNzTmFtZV0gIT09IGZhbHNlKSB7XG4gICAgICAgICAgICAgICAgZWxlbS5zZXRBdHRyaWJ1dGUoY2xhc3NOYW1lLCBjbGFzc2VzW2NsYXNzTmFtZV0pO1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICBlbGVtLnJlbW92ZUF0dHJpYnV0ZShjbGFzc05hbWUpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfSxcbiAgICBcImt0LW9uXCI6IGZ1bmN0aW9uIChlbGVtLCB2YWwsICRzY29wZSkge1xuICAgICAgICBsZXQga3RoZWxwZXIgPSBuZXcgS3RIZWxwZXIoKTtcblxuICAgICAgICAvLyBDbG9uZSB0aGUgZmlyc3QgbGF5ZXIgb2YgdGhlIHNjb3BlIHNvIGl0IGNhbiBiZSBldmFsdWF0ZWQgb24gZXZlbnRcbiAgICAgICAgbGV0IHNhdmVTY29wZSA9IHsuLi4kc2NvcGV9O1xuICAgICAgICBzYXZlU2NvcGUuJHNjb3BlID0gJHNjb3BlO1xuICAgICAgICAvL3NhdmVTY29wZS4kcmVmID0gJHNjb3BlLiRyZWY7XG5cbiAgICAgICAgbGV0IGV2ZW50cyA9IEpTT04ucGFyc2UodmFsKTtcbiAgICAgICAgZm9yIChsZXQgZXZlbnQgaW4gZXZlbnRzKSB7XG4gICAgICAgICAgICBlbGVtW1wib25cIiArIGV2ZW50XSA9IChlKSA9PiB7XG4gICAgICAgICAgICAgICAga3RoZWxwZXIua2V2YWwoZXZlbnRzW2V2ZW50XSwgc2F2ZVNjb3BlLCBlbGVtKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cblxuICAgIH1cbn07IiwiXG5cbmNsYXNzIEthSW5jbHVkZSBleHRlbmRzIEt0UmVuZGVyYWJsZSB7XG5cblxuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3JjXCI6IG51bGwsXG4gICAgICAgICAgICBcImF1dG9cIjogbnVsbCxcbiAgICAgICAgICAgIFwicmF3XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInNyY1wiLCBcImRlYnVnXCIsIFwiYXV0b1wiLCBcInJhd1wiXTtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIDxzY3JpcHQ+IHRhZ3MgdGhhdCB3ZXJlIGxvYWRlZCB2aWEgYWpheCB3b24ndCBiZSBleGVjdXRlZFxuICAgICAqIHdoZW4gYWRkZWQgdG8gZG9tLlxuICAgICAqXG4gICAgICogVGhlcmVmb3JlIHdlIGhhdmUgdG8gcmV3cml0ZSB0aGVtLiBUaGlzIG1ldGhvZCBkb2VzIHRoaXNcbiAgICAgKiBhdXRvbWF0aWNhbGx5IGJvdGggZm9yIG5vcm1hbCBhbmQgZm9yIHRlbXBsYXRlIChjb250ZW50KSBub2Rlcy5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBub2RlXG4gICAgICogQHByaXZhdGVcbiAgICAgKi9cbiAgICBfaW1wb3J0U2NyaXRwUmVjdXJzaXZlKG5vZGUpIHtcbiAgICAgICAgbGV0IGNoZWxzID0gbm9kZSBpbnN0YW5jZW9mIEhUTUxUZW1wbGF0ZUVsZW1lbnQgPyBub2RlLmNvbnRlbnQuY2hpbGROb2RlcyA6IG5vZGUuY2hpbGROb2RlcztcblxuICAgICAgICBmb3IgKGxldCBzIG9mIGNoZWxzKSB7XG4gICAgICAgICAgICBpZiAocy50YWdOYW1lICE9PSBcIlNDUklQVFwiKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW1wb3J0U2NyaXRwUmVjdXJzaXZlKHMpO1xuICAgICAgICAgICAgICAgIGNvbnRpbnVlO1xuICAgICAgICAgICAgfVxuICAgICAgICAgICAgbGV0IG4gPSBkb2N1bWVudC5jcmVhdGVFbGVtZW50KFwic2NyaXB0XCIpO1xuICAgICAgICAgICAgbi5pbm5lckhUTUwgPSBzLmlubmVySFRNTDtcbiAgICAgICAgICAgIHMucmVwbGFjZVdpdGgobik7XG4gICAgICAgIH1cbiAgICB9XG5cblxuICAgIF9sb2FkRGF0YVJlbW90ZSgpIHtcbiAgICAgICAgbGV0IHhodHRwID0gbmV3IFhNTEh0dHBSZXF1ZXN0KCk7XG5cbiAgICAgICAgeGh0dHAub3BlbihcIkdFVFwiLCB0aGlzLl9hdHRycy5zcmMpO1xuICAgICAgICB4aHR0cC5vbnJlYWR5c3RhdGVjaGFuZ2UgPSAoKSA9PiB7XG4gICAgICAgICAgICBpZiAoeGh0dHAucmVhZHlTdGF0ZSA9PT0gNCkge1xuICAgICAgICAgICAgICAgIGlmICh4aHR0cC5zdGF0dXMgPj0gNDAwKSB7XG4gICAgICAgICAgICAgICAgICAgIGNvbnNvbGUud2FybihcIkNhbid0IGxvYWQgJ1wiICsgdGhpcy5wYXJhbXMuc3JjICsgXCInOiBcIiArIHhodHRwLnJlc3BvbnNlVGV4dCk7XG4gICAgICAgICAgICAgICAgICAgIHJldHVybjtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB4aHR0cC5yZXNwb25zZVRleHQ7XG4gICAgICAgICAgICAgICAgaWYgKHRoaXMuX2F0dHJzLnJhdyAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICBsZXQgcCA9IG5ldyBLdFRlbXBsYXRlUGFyc2VyKCk7XG4gICAgICAgICAgICAgICAgICAgIHAucGFyc2VSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICAvLyBOb2RlcyBsb2FkZWQgZnJvbSByZW1vdGUgd29uJ3QgZ2V0IGV4ZWN1dGVkLiBTbyBpbXBvcnQgdGhlbS5cbiAgICAgICAgICAgICAgICB0aGlzLl9pbXBvcnRTY3JpdHBSZWN1cnNpdmUodGhpcy5jb250ZW50KTtcblxuICAgICAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpIHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9nKFwidHJpZ2dlciBET01Db250ZW50TG9hZGVkIGV2ZW50IG9uXCIsIGVsKTtcbiAgICAgICAgICAgICAgICAgICAgZWwuZGlzcGF0Y2hFdmVudChuZXcgRXZlbnQoXCJET01Db250ZW50TG9hZGVkXCIpKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgIH07XG5cbiAgICAgICAgeGh0dHAuc2VuZCgpO1xuICAgIH1cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBmb3IgKGxldCBlbCBvZiB0aGlzLl9lbHMpXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoZWwpO1xuICAgIH1cblxuICAgIGNvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICBsZXQgYXV0byA9IHRoaXMuZ2V0QXR0cmlidXRlKFwiYXV0b1wiKTtcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIGlmIChkb2N1bWVudC5yZWFkeVN0YXRlID09PSBcImxvYWRpbmdcIikge1xuICAgICAgICAgICAgICAgIGRvY3VtZW50LmFkZEV2ZW50TGlzdGVuZXIoXCJET01Db250ZW50TG9hZGVkXCIsICgpID0+IHtcbiAgICAgICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgICAgICB9KTtcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9hZERhdGFSZW1vdGUoKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgIH1cblxuICAgIHJlbmRlcihjb250ZXh0KSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cblxuICAgIH1cbn1cblxuY3VzdG9tRWxlbWVudHMuZGVmaW5lKFwia2EtaW5jbHVkZVwiLCBLYUluY2x1ZGUsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLYUxvb3AgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgdGhpcy5fb3JpZ1NpYmxpbmcgPSBmYWxzZTtcbiAgICAgICAgdGhpcy5fYXR0cnMgPSB7XG4gICAgICAgICAgICBcImZvcnNlbGVjdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3Jtb2RlXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmlkeFwiOiBudWxsLFxuICAgICAgICAgICAgXCJmb3JkYXRhXCI6IG51bGwsXG4gICAgICAgICAgICBcImZvcmV2YWxcIjogbnVsbFxuICAgICAgICB9XG4gICAgICAgIHRoaXMuX2VscyA9IFtdO1xuICAgIH1cblxuICAgIHN0YXRpYyBnZXQgb2JzZXJ2ZWRBdHRyaWJ1dGVzKCkge1xuICAgICAgICByZXR1cm4gW1wiZm9yc2VsZWN0XCIsIFwiZm9yaWR4XCIsIFwiZm9yZGF0YVwiLCBcImZvcmV2YWxcIiwgXCJmb3Jtb2RlXCJdO1xuICAgIH1cblxuXG4gICAgX2FwcGVuZEVsZW0oKSB7XG4gICAgICAgIGxldCBuZXdOb2RlID0gdGhpcy5jb250ZW50LmNsb25lTm9kZSh0cnVlKTtcbiAgICAgICAgbGV0IG5vZGVzID0gW107XG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgbmV3Tm9kZS5jaGlsZHJlbikge1xuICAgICAgICAgICAgY3VyTm9kZS5fa2FNYiA9IHRoaXMuX2t0SWQ7XG4gICAgICAgICAgICBub2Rlcy5wdXNoKGN1ck5vZGUpO1xuICAgICAgICB9XG4gICAgICAgIGZvciAobGV0IGkgPSAwOyBpIDwgbm9kZXMubGVuZ3RoOyBpKyspXG4gICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQuaW5zZXJ0QmVmb3JlKG5vZGVzW2ldLCB0aGlzLl9vcmlnU2libGluZyk7XG4gICAgICAgIHRoaXMuX2Vscy5wdXNoKHtcbiAgICAgICAgICAgIG5vZGU6IG5vZGVzXG4gICAgICAgIH0pO1xuICAgIH1cblxuXG4gICAgX21haW50YWluTm9kZShpLCAkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2Vscy5sZW5ndGggPCBpKzEpXG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtKCk7XG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3JpZHggIT09IG51bGwpXG4gICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yaWR4XSA9IGk7XG5cbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmZvcmV2YWwgIT09IG51bGwpXG4gICAgICAgICAgICB0aGlzLl9obHByLmtldmFsKHRoaXMuX2F0dHJzLmZvcmV2YWwsICRzY29wZSwgdGhpcyk7XG5cbiAgICAgICAgZm9yIChsZXQgY3VyTm9kZSBvZiB0aGlzLl9lbHNbaV0ubm9kZSkge1xuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgX2Ffc2VsID0gdGhpcy5fYXR0cnMuZm9yc2VsZWN0O1xuICAgICAgICBsZXQgc2VsID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCBfYV9zZWwsIHRoaXMpO1xuXG4gICAgICAgIGlmICh0aGlzLl9hdHRycy5mb3Jtb2RlICE9PSBcInJlcGVhdFwiKSB7XG5cbiAgICAgICAgICAgIGlmICh0eXBlb2Ygc2VsICE9PSBcIm9iamVjdFwiKSB7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBJbnZhbGlkIGZvclNlbGVjdD1cIiR7X2Ffc2VsfVwiIHJldHVybmVkOmAsIHNlbCwgXCJvbiBjb250ZXh0XCIsIGNvbnRleHQsIFwiKEVsZW1lbnQ6IFwiLCB0aGlzLCBcIilcIik7XG4gICAgICAgICAgICAgICAgdGhyb3cgXCJJbnZhbGlkIGZvclNlbGVjdCBzZWxlY3Rvci4gc2VlIHdhcmluZy5cIlxuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAoc2VsID09PSBudWxsIHx8ICh0eXBlb2Ygc2VsW1N5bWJvbC5pdGVyYXRvcl0gIT09IFwiZnVuY3Rpb25cIiAmJiB0eXBlb2Ygc2VsICE9PSAnb2JqZWN0JykgKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5fbG9nKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIG5vdCBpdGVyYWJsZS4gUmV0dXJuZWQgdmFsdWU6IGAsIHNlbCwgXCJpblwiLCB0aGlzKTtcbiAgICAgICAgICAgICAgICBjb25zb2xlLndhcm4oYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgbm90IGl0ZXJhYmxlLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgaWYgKHR5cGVvZiBzZWwgIT09IFwibnVtYmVyXCIpIHtcbiAgICAgICAgICAgICAgICB0aGlzLl9sb2coYFNlbGVjdG9yICcke19hX3NlbH0nIGluIGZvciBzdGF0ZW1lbnQgaXMgYSBudW1iZXIuIFJldHVybmVkIHZhbHVlOiBgLCBzZWwsIFwiaW5cIiwgdGhpcyk7XG4gICAgICAgICAgICAgICAgY29uc29sZS53YXJuKGBTZWxlY3RvciAnJHtfYV9zZWx9JyBpbiBmb3Igc3RhdGVtZW50IGlzIGEgbnVtYmVyLiBSZXR1cm5lZCB2YWx1ZTogYCwgc2VsLCBcImluXCIsIHRoaXMpXG4gICAgICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG5cbiAgICAgICAgaWYgKHRoaXMuX29yaWdTaWJsaW5nID09PSBmYWxzZSlcbiAgICAgICAgICAgIHRoaXMuX29yaWdTaWJsaW5nID0gdGhpcy5uZXh0U2libGluZztcblxuXG4gICAgICAgIGxldCBuID0gMDtcbiAgICAgICAgc3dpdGNoICh0aGlzLl9hdHRycy5mb3Jtb2RlKSB7XG4gICAgICAgICAgICBjYXNlIFwiaW5cIjpcbiAgICAgICAgICAgICAgICBuID0gMDtcbiAgICAgICAgICAgICAgICBmb3IobGV0IGkgaW4gc2VsKSB7XG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IGk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwib2ZcIjpcbiAgICAgICAgICAgICAgICBuID0gMDtcbiAgICAgICAgICAgICAgICBmb3IgKGxldCBpIG9mIHNlbCkge1xuXG4gICAgICAgICAgICAgICAgICAgICRzY29wZVt0aGlzLl9hdHRycy5mb3JkYXRhXSA9IGk7XG4gICAgICAgICAgICAgICAgICAgIHRoaXMuX21haW50YWluTm9kZShuLCAkc2NvcGUpO1xuICAgICAgICAgICAgICAgICAgICBuKys7XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIGJyZWFrO1xuXG4gICAgICAgICAgICBjYXNlIFwicmVwZWF0XCI6XG4gICAgICAgICAgICAgICAgZm9yIChuPTA7IG4gPCBzZWw7IG4rKykge1xuICAgICAgICAgICAgICAgICAgICAkc2NvcGVbdGhpcy5fYXR0cnMuZm9yZGF0YV0gPSBuO1xuICAgICAgICAgICAgICAgICAgICB0aGlzLl9tYWludGFpbk5vZGUobiwgJHNjb3BlKTtcbiAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgYnJlYWs7XG4gICAgICAgICAgICBkZWZhdWx0OlxuICAgICAgICAgICAgICAgIHRocm93IFwiSW52YWxpZCBmb3IgdHlwZSAnXCIgKyB0aGlzLl9hdHRycy5mb3Jtb2RlICsgXCInIGluIFwiIC4gdGhpcy5vdXRlckhUTUw7XG4gICAgICAgIH1cblxuXG4gICAgICAgIGZvciAobGV0IGlkeCA9IG47IHNlbC5sZW5ndGggPCB0aGlzLl9lbHMubGVuZ3RoOyBpZHgrKykge1xuICAgICAgICAgICAgbGV0IGVsZW0gPSB0aGlzLl9lbHMucG9wKCk7XG4gICAgICAgICAgICBmb3IgKGxldCBjdXJOb2RlIG9mIGVsZW0ubm9kZSkge1xuICAgICAgICAgICAgICAgIGlmICh0eXBlb2YgY3VyTm9kZS5fcmVtb3ZlTm9kZXMgPT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICAgICAgY3VyTm9kZS5fcmVtb3ZlTm9kZXMoKTtcbiAgICAgICAgICAgICAgICB0aGlzLnBhcmVudEVsZW1lbnQucmVtb3ZlQ2hpbGQoY3VyTm9kZSk7XG4gICAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImthLWxvb3BcIiwgS2FMb29wLCB7ZXh0ZW5kczogXCJ0ZW1wbGF0ZVwifSk7IiwidmFyIEtBU0VMRiA9IG51bGw7XG5cbmNsYXNzIEthVHBsIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJkZWJ1Z1wiOiBmYWxzZSxcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsLFxuICAgICAgICAgICAgXCJhZnRlcnJlbmRlclwiOiBudWxsLFxuICAgICAgICAgICAgXCJub2RlYm91bmNlXCI6IGZhbHNlXG4gICAgICAgIH07XG5cbiAgICAgICAgLy8gU3dpdGNoZWQgdG8gdG8gZHVyaW5nIF9pbml0KCkgdG8gYWxsb3cgPHNjcmlwdD4gdG8gc2V0IHNjb3BlIHdpdGhvdXQgcmVuZGVyaW5nLlxuICAgICAgICB0aGlzLl9pc0luaXRpYWxpemluZyA9IGZhbHNlO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IGZhbHNlO1xuXG4gICAgICAgIC8vIFN0b3JlIHJlZi9vbi9mbiBvdXRzaWRlIHRvIGFsbG93IHNldHRpbmcgJHNjb3BlIHdpdGhvdXQgb3ZlcndyaXRpbmcgdGhlbVxuICAgICAgICB0aGlzLl9yZWZzID0ge307XG4gICAgICAgIHRoaXMuX29uID0ge307XG4gICAgICAgIHRoaXMuX2ZuID0ge307XG4gICAgICAgIHRoaXMuX3Njb3BlID0ge1wiJHJlZlwiOnRoaXMuX3JlZnMsIFwiJG9uXCI6IHRoaXMuX29uLCBcIiRmblwiOiB0aGlzLl9mbn07XG5cbiAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IG51bGw7XG4gICAgICAgIHRoaXMuX2hhbmRsZXIgPSB7fTtcbiAgICB9XG5cbiAgICAvKipcbiAgICAgKiBSZWZlciB0byB0aGUgY3VycmVudCB0ZW1wbGF0ZSAoc2hvdWxkIGJlIHVzZWQgYnkgPHNjcmlwdD4gaW5zaWRlIGEgdGVtcGxhdGUgdG8gcmVmZXJlbmNlIHRoZVxuICAgICAqIGN1cnJlbnQgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIEB0eXBlIHtLYVRwbH1cbiAgICAgKi9cbiAgICBzdGF0aWMgZ2V0IHNlbGYoKSB7XG4gICAgICAgIHJldHVybiBLYVRwbC5wcm90b3R5cGUuc2VsZjtcbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25CZWZvcmVEaXNjb25uZWN0KTtcbiAgICAgICAgZm9yIChsZXQgZWwgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKGVsKTtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgdGhpcy5fbG9nKFwiY29ubmVjdGVkQ2FsbGJhY2soKVwiLCB0aGlzKTtcbiAgICAgICAgbGV0IGF1dG8gPSB0aGlzLmdldEF0dHJpYnV0ZShcImF1dG9cIilcbiAgICAgICAgaWYgKGF1dG8gIT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2xvZyhcImF1dG9zdGFydDogX2luaXQoKVwiLCBcImRvY3VtZW50LnJlYWR5U3RhdGU6IFwiLCBkb2N1bWVudC5yZWFkeVN0YXRlKTtcblxuICAgICAgICAgICAgbGV0IGluaXQgPSAoKSA9PiB7XG4gICAgICAgICAgICAgICAgdGhpcy5faW5pdCgpO1xuICAgICAgICAgICAgICAgIGlmIChhdXRvID09PSBcIlwiKVxuICAgICAgICAgICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLiRzY29wZSk7XG4gICAgICAgICAgICAgICAgZWxzZVxuICAgICAgICAgICAgICAgICAgICBldmFsKGF1dG8pO1xuICAgICAgICAgICAgfTtcblxuICAgICAgICAgICAgaWYgKGRvY3VtZW50LnJlYWR5U3RhdGUgPT09IFwibG9hZGluZ1wiKSB7XG4gICAgICAgICAgICAgICAgZG9jdW1lbnQuYWRkRXZlbnRMaXN0ZW5lcihcIkRPTUNvbnRlbnRMb2FkZWRcIiwgKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICBpbml0KCk7XG4gICAgICAgICAgICAgICAgfSlcbiAgICAgICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICAgICAgaW5pdCgpO1xuICAgICAgICAgICAgfVxuICAgICAgICB9XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogU2V0IHRoZSBzY29wZSBhbmQgcmVuZGVyIHRoZSB0ZW1wbGF0ZVxuICAgICAqXG4gICAgICogYGBgXG4gICAgICoga2FfdHBsKFwidHBsMDFcIikuJHNjb3BlID0ge25hbWU6IFwiYm9iXCJ9O1xuICAgICAqIGBgYFxuICAgICAqXG4gICAgICogQHBhcmFtIHZhbFxuICAgICAqL1xuICAgIHNldCAkc2NvcGUodmFsKSB7XG4gICAgICAgIHRoaXMuX3Njb3BlID0gdmFsO1xuXG4gICAgICAgIC8vIFNldCBpbW11dGFibGUgZGF0YVxuICAgICAgICB0aGlzLl9zY29wZS4kcmVmID0gdGhpcy5fcmVmcztcbiAgICAgICAgdGhpcy5fc2NvcGUuJG9uID0gdGhpcy5fb247XG4gICAgICAgIHRoaXMuX3Njb3BlLiRmbiA9IHRoaXMuX2ZuO1xuXG4gICAgICAgIC8vIFJlbmRlciBvbmx5IGlmIGRvbSBhdmFpbGFibGUgKGFsbG93IDxzY3JpcHQ+IGluc2lkZSB0ZW1wbGF0ZSB0byBzZXQgc2NvcGUgYmVmb3JlIGZpcnN0IHJlbmRlcmluZ1xuICAgICAgICBpZiAoICEgdGhpcy5faXNJbml0aWFsaXppbmcpXG4gICAgICAgICAgICB0aGlzLnJlbmRlcih0aGlzLl9zY29wZSk7XG4gICAgfVxuXG4gICAgZ2V0ICRzY29wZSgpIHtcbiAgICAgICAgbGV0IGhhbmRsZXIgPSB7XG4gICAgICAgICAgICBzZXQ6ICh0YXJnZXQsIHByb3BlcnR5LCB2YWx1ZSwgcmVjZWl2ZXIpID0+IHtcbiAgICAgICAgICAgICAgICAvL2NvbnNvbGUubG9nIChcInNldDpcIiwgdGFyZ2V0LCBwcm9wZXJ0eSwgdmFsdWUpO1xuICAgICAgICAgICAgICAgIHRhcmdldFtwcm9wZXJ0eV0gPSB2YWx1ZTtcbiAgICAgICAgICAgICAgICAvLyBEb24ndCB1cGRhdGUgcHJveHkgZHVyaW5nIHJlbmRlcmluZyAocmVjdXJzaW9uKVxuICAgICAgICAgICAgICAgIGlmICggISB0aGlzLl9pc1JlbmRlcmluZykge1xuICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMubm9kZWJvdW5jZSA9PT0gZmFsc2UpIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIC8vIERlZmF1bHQgYmVoYXZpb3VyOiBEZWJvdW5jZTogU28geW91IGNhbiBkbyBtdWx0aXBsZSAkc2NvcGUgdXBkYXRlZCB3aXRoIHJlbmRpbmcgb25seSBvbmNlXG4gICAgICAgICAgICAgICAgICAgICAgICBpZiAodGhpcy5fX2RlYm91bmNlVGltZW91dCAhPT0gbnVsbCkge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHdpbmRvdy5jbGVhclRpbWVvdXQodGhpcy5fX2RlYm91bmNlVGltZW91dCk7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgdGhpcy5fX2RlYm91bmNlVGltZW91dCA9IG51bGw7XG4gICAgICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICAgICAgICB0aGlzLl9fZGVib3VuY2VUaW1lb3V0ID0gd2luZG93LnNldFRpbWVvdXQoKCkgPT4ge1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgICAgIH0sIDEwKTtcbiAgICAgICAgICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICAgICAgICAgIHRoaXMucmVuZGVyKHRoaXMuJHNjb3BlKTtcbiAgICAgICAgICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgIHJldHVybiB0cnVlO1xuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIGdldDogKHRhcmdldCwga2V5KSA9PiB7XG4gICAgICAgICAgICAgICAgLy8gUmV0dXJuIGRpcmVjdCBsaW5rIHRvIGltbXV0YWJsZSBkYXRhXG4gICAgICAgICAgICAgICAgc3dpdGNoIChrZXkpIHtcbiAgICAgICAgICAgICAgICAgICAgY2FzZSBcIiRyZWZcIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9yZWZzO1xuICAgICAgICAgICAgICAgICAgICBjYXNlIFwiJG9uXCI6XG4gICAgICAgICAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5fb247XG4gICAgICAgICAgICAgICAgICAgIGNhc2UgXCIkZm5cIjpcbiAgICAgICAgICAgICAgICAgICAgICAgIHJldHVybiB0aGlzLl9mbjtcbiAgICAgICAgICAgICAgICB9XG5cbiAgICAgICAgICAgICAgICBpZiAodHlwZW9mIHRhcmdldFtrZXldID09PSBcIm9iamVjdFwiICYmIHRhcmdldFtrZXldICE9PSBudWxsKVxuICAgICAgICAgICAgICAgICAgICByZXR1cm4gbmV3IFByb3h5KHRhcmdldFtrZXldLCBoYW5kbGVyKTtcbiAgICAgICAgICAgICAgICByZXR1cm4gdGFyZ2V0W2tleV07XG4gICAgICAgICAgICB9XG5cbiAgICAgICAgfTtcbiAgICAgICAgcmV0dXJuIG5ldyBQcm94eSh0aGlzLl9zY29wZSwgaGFuZGxlcik7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogRXhlY3V0ZSBjdXN0b20gZnVuY3Rpb25zIGZyb20gb3V0c2lkZSB0aGUgdGVtcGxhdGVcbiAgICAgKlxuICAgICAqIDxleGFtcGxlPlxuICAgICAqICAgICBrYV90cGwoXCJ0cGwxXCIpLiRmbi5kb1NvbWV0aGluZygpO1xuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEByZXR1cm4ge3tjdXN0b21GbjogKGZ1bmN0aW9uKCopOiBzdHJpbmcpfXx7fX1cbiAgICAgKi9cbiAgICBnZXQgJGZuICgpIHtcbiAgICAgICAgcmV0dXJuIHRoaXMuJHNjb3BlLiRmbjtcbiAgICB9XG5cblxuICAgIC8qKlxuICAgICAqIEV4ZWN1dGUgY3VzdG9tIGZ1bmN0aW9uIG9uIGV2ZW50XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHt7XG4gICAgICogICAgICBvbkFmdGVyUmVuZGVyOiAoZnVuY3Rpb24oJHNjb3BlKTogdm9pZCksXG4gICAgICogICAgICBvbkFmdGVyRmlyc3RSZW5kZXI6IChmdW5jdGlvbigkc2NvcGUpOiB2b2lkKVxuICAgICAqICAgICAgb25CZWZvcmVEaXNjb25uZWN0OiAoZnVuY3Rpb24oJHNjb3BlKTogdm9pZClcbiAgICAgKiAgICAgIH19XG4gICAgICovXG4gICAgZ2V0ICRvbiAoKSB7XG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZS4kb247XG4gICAgfVxuXG5cbiAgICAvKipcbiAgICAgKiBJbml0aWFsaXplIHRoZSBzY29wZS4gV2lsbCByZXR1cm4gdGhlIHByb3hpZWQgc2NvcGUgb2JqZWN0LlxuICAgICAqXG4gICAgICogVGhlIHByb3h5IGtlZXBzIHRyYWNrIGFib3V0IGNoYW5nZXMgdG8gJHNjb3BlIGFuZCByZXJlbmRlcnMgdGhlXG4gICAgICogZGF0YSB0aGVuLlxuICAgICAqXG4gICAgICogU28geW91IGNhbiB1c2UgdGhlIHJldHVybiB2YWx1ZSB3aXRoaW4gdGhlIHNjb3BlIGRlZmluaXRpb24gaXRzZWxmLlxuICAgICAqXG4gICAgICogPGV4YW1wbGU+XG4gICAgICogbGV0ICRzY29wZSA9IEthVHBsLnNlbGYuc2NvcGVJbml0KHtzb21lRGF0YTogW119KTtcbiAgICAgKiA8L2V4YW1wbGU+XG4gICAgICpcbiAgICAgKiBAcGFyYW0ge3skZm46e30sICRvbjp7fX19ICRzY29wZVxuICAgICAqIEByZXR1cm4ge1Byb3h5PHt9Pn1cbiAgICAgKi9cbiAgICBzY29wZUluaXQoJHNjb3BlKSB7XG4gICAgICAgIGlmICh0eXBlb2YgJHNjb3BlLiRmbiAhPT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgIHRoaXMuX2ZuID0gJHNjb3BlLiRmbjtcbiAgICAgICAgaWYgKHR5cGVvZiAkc2NvcGUuJG9uICE9PSBcInVuZGVmaW5lZFwiKVxuICAgICAgICAgICAgdGhpcy5fb24gPSAkc2NvcGUuJG9uO1xuXG4gICAgICAgIHRoaXMuJHNjb3BlID0gJHNjb3BlO1xuXG4gICAgICAgIHJldHVybiB0aGlzLiRzY29wZTsgLy8gPC0gUXVlcnkgc2NvcGUgb3ZlciBnZXR0ZXIgdG8gcmVjZWl2ZSBwcm94eVxuICAgIH1cblxuXG4gICAgLyoqXG4gICAgICogV2FpdCBmb3IgYSByZWZlcmVuY2UgdG8gYmUgcmVuZGVyZWRcbiAgICAgKlxuICAgICAqIFJldHVybnMgYSBwcm9taXNlIHRoYXQgaXMgcmVzb2x2ZWQgb25jZSB0aGUgUmVmZXJlbmNlZFxuICAgICAqIEVsZW1lbnQgKGNvbnRhaW5pbmcgKnJlZiBhdHRyaWJ1dGUpIGluIHRlbXBsYXRlIGFuZCBhbGwgaXRzXG4gICAgICogY2hpbGQgZWxlbWVudHMgd2FzIHJlbmRlcmVkLlxuICAgICAqXG4gICAgICogSWYgdGhlIGVsZW1lbnRcbiAgICAgKlxuICAgICAqIDxleGFtcGxlPlxuICAgICAqICAgICA8c2NyaXB0PlxuICAgICAqICAgICAgICAgIChhc3luYyhzZWxmKSA9PiAge1xuXG4gICAgICAgICAgICAgICAgICAgIGxldCBpbnB1dCA9IGF3YWl0IHNlbGYud2FpdFJlZihcImlucHV0MVwiKTtcbiAgICAgICAgICAgICAgICAgICAgY29uc29sZS5sb2cgKGlucHV0ICk7XG4gICAgICAgICAgICAgICAgfSkoS2FUcGwuc2VsZik7XG4gICAgICogICAgIDwvc2NyaXB0PlxuICAgICAqICAgICBsZXQgZWxlbSA9IGF3YWl0IHNlbGYud2FpdFJlZihcImlucHV0MVwiKVxuICAgICAqIDwvZXhhbXBsZT5cbiAgICAgKlxuICAgICAqIEBwYXJhbSBuYW1lXG4gICAgICogQHJldHVybiB7UHJvbWlzZX1cbiAgICAgKi9cbiAgICB3YWl0UmVmKG5hbWUpIHtcbiAgICAgICAgaWYgKHR5cGVvZiB0aGlzLiRzY29wZS4kcmVmW25hbWVdID09PSBcInVuZGVmaW5lZFwiKSB7XG4gICAgICAgICAgICB2YXIgcmVzb2x2ZXI7XG4gICAgICAgICAgICBsZXQgcCA9IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuICAgICAgICAgICAgICAgIHJlc29sdmVyID0gcmVzb2x2ZVxuICAgICAgICAgICAgfSk7XG4gICAgICAgICAgICBwLnJlc29sdmUgPSBmdW5jdGlvbiAodmFsdWUpIHtcbiAgICAgICAgICAgICAgICByZXNvbHZlcih2YWx1ZSk7XG4gICAgICAgICAgICB9O1xuICAgICAgICAgICAgdGhpcy4kc2NvcGUuJHJlZltuYW1lXSA9IHA7XG4gICAgICAgICAgICByZXR1cm4gcDtcbiAgICAgICAgfVxuICAgICAgICAvLyBSZXR1cm4gaW1tZWRpYXRlIGlmIHJlZmVyZW5jZSBhbHJlYWR5IGV4aXN0aW5nXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy4kc2NvcGUuJHJlZltuYW1lXSk7XG4gICAgfVxuXG4gICAgLyoqXG4gICAgICogVmVyaWZ5IGlmIHRoaXMgaXMgdGhlIGZpcnN0IHJlbmRlciBhdHRlbXB0XG4gICAgICpcbiAgICAgKiBAcmV0dXJuIHtib29sZWFufSBUcnVlIGlmIGZpcnN0IHJlbmRlclxuICAgICAqIEBwcml2YXRlXG4gICAgICovXG4gICAgX2luaXQoKSB7XG4gICAgICAgIGlmICh0aGlzLl9lbHMgIT09IG51bGwpXG4gICAgICAgICAgICByZXR1cm4gZmFsc2U7XG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gdHJ1ZTtcbiAgICAgICAgaWYgKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nICE9PSBudWxsKSB7XG4gICAgICAgICAgICAvLyBSZW1vdmUgbG9hZGVyIGVsZW1lbnRcbiAgICAgICAgICAgIGlmICh0aGlzLm5leHRFbGVtZW50U2libGluZy5oYXNBdHRyaWJ1dGUoXCJrYS1sb2FkZXJcIikpXG4gICAgICAgICAgICAgICAgdGhpcy5wYXJlbnRFbGVtZW50LnJlbW92ZUNoaWxkKHRoaXMubmV4dEVsZW1lbnRTaWJsaW5nKTtcbiAgICAgICAgfVxuICAgICAgICBsZXQgc2libGluZyA9IHRoaXMubmV4dFNpYmxpbmc7XG5cbiAgICAgICAgKG5ldyBLdFRlbXBsYXRlUGFyc2VyKS5wYXJzZVJlY3Vyc2l2ZSh0aGlzLmNvbnRlbnQpO1xuXG4gICAgICAgIC8vIFJlZ2lzdGVyIHNlbGYgcmVmZXJlbmNlIChzZWU6IEthVHBsLnNlbGYpXG4gICAgICAgIEtBU0VMRiA9IHRoaXM7XG4gICAgICAgIEthVHBsLnByb3RvdHlwZS5zZWxmID0gdGhpcztcblxuICAgICAgICBpZiAodGhpcy5fZWxzID09PSBudWxsKSB7XG4gICAgICAgICAgICB0aGlzLl9hcHBlbmRFbGVtZW50c1RvUGFyZW50KCk7XG5cbiAgICAgICAgfVxuXG4gICAgICAgIHRoaXMuX2lzSW5pdGlhbGl6aW5nID0gZmFsc2U7XG4gICAgICAgIHJldHVybiB0cnVlO1xuICAgIH1cblxuXG4gICAgX3J1blRyaWdnZXJGdW5jdGlvbihmbikge1xuICAgICAgICBpZiAodHlwZW9mIGZuID09PSBcImZ1bmN0aW9uXCIpXG4gICAgICAgICAgICBmbigkc2NvcGUsIHRoaXMpO1xuICAgIH1cblxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBpZiAodHlwZW9mICRzY29wZSA9PT0gXCJ1bmRlZmluZWRcIilcbiAgICAgICAgICAgICRzY29wZSA9IHRoaXMuJHNjb3BlO1xuICAgICAgICB0aGlzLl9sb2coXCJyZW5kZXIoJHNjb3BlPSBcIiwgJHNjb3BlLCBcIilcIik7XG4gICAgICAgIGxldCBpc0ZpcnN0UmVuZGVyID0gdGhpcy5faW5pdCgpO1xuICAgICAgICB0aGlzLl9pc1JlbmRlcmluZyA9IHRydWU7XG4gICAgICAgIGZvcihsZXQgY2Ugb2YgdGhpcy5fZWxzKSB7XG4gICAgICAgICAgICB0aGlzLnJlbmRlclJlY3Vyc2l2ZShjZSwgJHNjb3BlKTtcbiAgICAgICAgfVxuXG4gICAgICAgIC8vIEV4ZWN1dGUgJG9uIGNhbGxiYWNrc1xuICAgICAgICBpZiAoaXNGaXJzdFJlbmRlcikge1xuICAgICAgICAgICAgdGhpcy5fcnVuVHJpZ2dlckZ1bmN0aW9uKHRoaXMuJG9uLm9uQWZ0ZXJGaXJzdFJlbmRlcilcbiAgICAgICAgfVxuICAgICAgICB0aGlzLl9ydW5UcmlnZ2VyRnVuY3Rpb24odGhpcy4kb24ub25BZnRlclJlbmRlcik7XG4gICAgICAgIHRoaXMuX2lzUmVuZGVyaW5nID0gZmFsc2U7XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS10cGxcIiwgS2FUcGwsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTtcbiIsImNsYXNzIEthVmFsIGV4dGVuZHMgSFRNTEVsZW1lbnQge1xuXG5cbiAgICBjb25zdHJ1Y3RvcigpIHtcbiAgICAgICAgc3VwZXIoKTtcbiAgICAgICAgLyoqXG4gICAgICAgICAqXG4gICAgICAgICAqIEB0eXBlIHtLdEhlbHBlcn1cbiAgICAgICAgICogQHByaXZhdGVcbiAgICAgICAgICovXG4gICAgICAgIHRoaXMuX2t0SGxwciA9IG5ldyBLdEhlbHBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwiZGVidWdcIjogZmFsc2UsXG4gICAgICAgICAgICBcInN0bXRcIjogbnVsbCxcbiAgICAgICAgICAgIFwiYWZ0ZXJyZW5kZXJcIjogbnVsbFxuICAgICAgICB9XG4gICAgfVxuXG4gICAgc3RhdGljIGdldCBvYnNlcnZlZEF0dHJpYnV0ZXMoKSB7XG4gICAgICAgIHJldHVybiBbXCJzdG10XCIsIFwiYWZ0ZXJyZW5kZXJcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cbiAgICBhdHRyaWJ1dGVDaGFuZ2VkQ2FsbGJhY2soYXR0ck5hbWUsIG9sZFZhbCwgbmV3VmFsKSB7XG4gICAgICAgIHRoaXMuX2F0dHJzW2F0dHJOYW1lXSA9IG5ld1ZhbDtcbiAgICB9XG5cbiAgICBjb25uZWN0ZWRDYWxsYmFjaygpIHtcbiAgICAgICAgaWYgKHRoaXMuaGFzQXR0cmlidXRlKFwiYXV0b1wiKSlcbiAgICAgICAgICAgIHRoaXMucmVuZGVyKHt9KTtcbiAgICB9XG4gICAgX2xvZygpIHtcbiAgICAgICAgaWYgKHRoaXMuX2F0dHJzLmRlYnVnICE9PSBmYWxzZSkge1xuXG4gICAgICAgICAgICBjb25zb2xlLmxvZy5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgICB9XG5cbiAgICB9XG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICB0aGlzLl9sb2coYHJlbmRlcihgLCAkc2NvcGUsIGApIG9uICcke3RoaXMub3V0ZXJIVE1MfSdgKTtcbiAgICAgICAgdHJ5IHtcblxuICAgICAgICAgICAgbGV0IHYgPSB0aGlzLl9rdEhscHIuc2NvcGVFdmFsKCRzY29wZSwgdGhpcy5fYXR0cnMuc3RtdCk7XG4gICAgICAgICAgICBpZiAodHlwZW9mIHYgPT09IFwib2JqZWN0XCIpXG4gICAgICAgICAgICAgICAgdiA9IEpTT04uc3RyaW5naWZ5KHYpO1xuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJ1bmluZGVudFwiKSkge1xuICAgICAgICAgICAgICAgIHYgPSB0aGlzLl9rdEhscHIudW5pbmRlbnRUZXh0KHYpO1xuICAgICAgICAgICAgfVxuXG4gICAgICAgICAgICBpZiAodGhpcy5oYXNBdHRyaWJ1dGUoXCJodG1sXCIpKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5pbm5lckhUTUwgPSB2O1xuICAgICAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICAgICAgICB0aGlzLmlubmVyVGV4dCA9IHY7XG4gICAgICAgICAgICB9XG4gICAgICAgICAgICBpZiAodGhpcy5fYXR0cnMuYWZ0ZXJyZW5kZXIgIT09IG51bGwpXG4gICAgICAgICAgICAgICAgZXZhbCh0aGlzLl9hdHRycy5hZnRlcnJlbmRlcilcbiAgICAgICAgfSBjYXRjaCAoZSkge1xuICAgICAgICAgICAgdGhpcy5pbm5lclRleHQgPSBlO1xuICAgICAgICB9XG4gICAgfVxufVxuXG5jdXN0b21FbGVtZW50cy5kZWZpbmUoXCJrYS12YWxcIiwgS2FWYWwpOyIsIlxuXG5cbmNsYXNzIEt0SWYgZXh0ZW5kcyBLdFJlbmRlcmFibGUge1xuICAgIGNvbnN0cnVjdG9yKCkge1xuICAgICAgICBzdXBlcigpO1xuICAgICAgICB0aGlzLl9hdHRycyA9IHtcbiAgICAgICAgICAgIFwic3RtdFwiOiBudWxsXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIl07XG4gICAgfVxuXG4gICAgcmVuZGVyKCRzY29wZSkge1xuICAgICAgICBsZXQgaXNUcnVlID0gdGhpcy5faGxwci5zY29wZUV2YWwoJHNjb3BlLCB0aGlzLl9hdHRycy5zdG10KTtcblxuICAgICAgICBpZiAoICEgaXNUcnVlKSB7XG4gICAgICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgICAgICAgICAgcmV0dXJuO1xuICAgICAgICB9XG4gICAgICAgIGlmICh0aGlzLl9lbHMgPT09IG51bGwpIHtcbiAgICAgICAgICAgIHRoaXMuX2FwcGVuZEVsZW1lbnRzVG9QYXJlbnQoKTtcbiAgICAgICAgfVxuXG4gICAgICAgIGZvciAobGV0IGN1ck5vZGUgb2YgdGhpcy5fZWxzKVxuICAgICAgICAgICAgdGhpcy5yZW5kZXJSZWN1cnNpdmUoY3VyTm9kZSwgJHNjb3BlKTtcbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LWlmXCIsIEt0SWYsIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiLCJcblxuXG5jbGFzcyBLdE1haW50YWluIGV4dGVuZHMgS3RSZW5kZXJhYmxlIHtcblxuXG4gICAgY29uc3RydWN0b3IoKSB7XG4gICAgICAgIHN1cGVyKCk7XG4gICAgICAgIHRoaXMuX2F0dHJzID0ge1xuICAgICAgICAgICAgXCJzdG10XCI6IG51bGwsXG4gICAgICAgICAgICBcImRlYnVnXCI6IGZhbHNlXG4gICAgICAgIH1cbiAgICB9XG5cbiAgICBzdGF0aWMgZ2V0IG9ic2VydmVkQXR0cmlidXRlcygpIHtcbiAgICAgICAgcmV0dXJuIFtcInN0bXRcIiwgXCJkZWJ1Z1wiXTtcbiAgICB9XG5cblxuICAgIGRpc2Nvbm5lY3RlZENhbGxiYWNrKCkge1xuICAgICAgICB0aGlzLl9yZW1vdmVOb2RlcygpO1xuICAgIH1cblxuICAgIHJlbmRlcigkc2NvcGUpIHtcbiAgICAgICAgaWYgKHRoaXMuX2VscyA9PT0gbnVsbCkge1xuICAgICAgICAgICAgdGhpcy5fYXBwZW5kRWxlbWVudHNUb1BhcmVudCgpXG4gICAgICAgIH1cblxuICAgICAgICBmb3IgKGxldCBjdXJFbGVtZW50IG9mIHRoaXMuX2Vscykge1xuICAgICAgICAgICAgaWYgKCB0eXBlb2YgY3VyRWxlbWVudC5oYXNBdHRyaWJ1dGUgIT09IFwiZnVuY3Rpb25cIilcbiAgICAgICAgICAgICAgICBjb250aW51ZTtcbiAgICAgICAgICAgIGZvciAobGV0IGF0dHJOYW1lIGluIEtUX0ZOKSB7XG4gICAgICAgICAgICAgICAgaWYgKCAhIGN1ckVsZW1lbnQuaGFzQXR0cmlidXRlKGF0dHJOYW1lKSlcbiAgICAgICAgICAgICAgICAgICAgY29udGludWU7XG4gICAgICAgICAgICAgICAgS1RfRk5bYXR0ck5hbWVdKGN1ckVsZW1lbnQsIGN1ckVsZW1lbnQuZ2V0QXR0cmlidXRlKGF0dHJOYW1lKSwgJHNjb3BlKTtcbiAgICAgICAgICAgIH1cbiAgICAgICAgICAgIHRoaXMucmVuZGVyUmVjdXJzaXZlKGN1ckVsZW1lbnQsICRzY29wZSwgdHJ1ZSk7XG4gICAgICAgIH1cbiAgICB9XG59XG5cbmN1c3RvbUVsZW1lbnRzLmRlZmluZShcImt0LW1haW50YWluXCIsIEt0TWFpbnRhaW4sIHtleHRlbmRzOiBcInRlbXBsYXRlXCJ9KTsiXX0=