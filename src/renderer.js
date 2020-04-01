

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


        if (node.hasAttribute("ngFor")) {
            nodeOrig = node;
            node = node.cloneNode(true);

            tpl = new KT_ForDirective();
            tpl.state.ngFor = node.getAttribute("ngFor");

            let elem = new KT_ForElement();
            //elem.appendChild(node);
            elem.state.origNode = node;

            tpl.state.origNode = elem;

            curTplElem.state.parentTpls.push(tpl);
            curTplElem = elem;
        }


        for (let i=0; i < node.children.length; i++) {
            this._parse(node.children.item(i), curTplElem);
        }
        if (tpl === null) {

        } else {
            nodeOrig.replaceWith(tpl);

        }
    }

    /**
     *
     * @param templateNode
     * @return {KT_Template}
     */
    getTemplate(templateNode) {
        let tpl = new KT_Template();

        if (templateNode instanceof HTMLTemplateElement) {
            let mainNode = templateNode.content.children.item(0);
            console.log("Template start", mainNode);

            templateNode.parentElement.ownerDocument.adoptNode(mainNode);

            tpl.state.origNode = mainNode.cloneNode(true);
            templateNode.parentElement.appendChild(tpl);
            this._parse(mainNode, tpl);

        } else {
            tpl.state.origNode = templateNode;
            this._parse(templateNode, tpl);
        }

        return tpl;
    }
}