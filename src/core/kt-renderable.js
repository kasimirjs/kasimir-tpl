
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
        this._ktId = ++_KT_ELEMENT_ID;
        this._els = null;
        this._attrs = {"debug": false};
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



