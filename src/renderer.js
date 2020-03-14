

class Renderer {

    constructor() {
        /**
         *
         * @type {KT_ForDirective[]}
         */
        this.directives = [
            KT_ForDirective
        ]
    }


    /**
     *
     * @param {HTMLDivElement} node
     * @param {KT_Renderable} curTplElem
     * @private
     */
    _parse(node, curTplElem) {
        let tpl = null;
        let nodeOrig = null;
        console.log("run", node);

        for (let i = 0; i < this.directives.length; i++) {
            let directive = this.directives[i];
            if (directive.applies(node)) {
                nodeOrig = node;
                node = node.cloneNode(true);
                tpl = new directive(node);
                curTplElem.parentTpls.push(tpl);
                curTplElem = tpl;
            }
        }


        for (let i=0; i < node.children.length; i++) {
            this._parse(node.children.item(i), curTplElem);
        }

        if (tpl !== null)
            nodeOrig.replaceWith(tpl);
    }

    /**
     *
     * @param templateNode
     * @return {TplElem}
     */
    getTemplate(templateNode) {
        let tpl = new KT_Template(templateNode);
        this._parse(templateNode, tpl);
        return tpl;
    }
}