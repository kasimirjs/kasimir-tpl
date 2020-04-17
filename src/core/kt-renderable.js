
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
    }



    _log() {
        if (this._attrs.debug !== false)
            console.log(arguments);
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



