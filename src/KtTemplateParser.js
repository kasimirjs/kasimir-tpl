

class KtTemplateParser {


    /**
     *
     * @param {HTMLElement} node
     */
    parseRecursive(node) {
        if (typeof node.getAttribute !== "function")
            return;

        console.log("parse", node.outerHTML)
        if (node.hasAttribute("*for")) {
            let newNode = document.createElement("template", {is: "kt-for"});
            let attr = node.getAttribute("*for");
            /* @var {HTMLTemplateElement} newNode */
            newNode.content.appendChild(node.cloneNode(true));
            newNode.setAttribute("forselect", attr);
            node.replaceWith(newNode);
        }

        if (node.hasAttribute("*if")) {
            let newNode = document.createElement("template", {is: "kt-if"});
            let attr = node.getAttribute("*if");
            /* @var {HTMLTemplateElement} newNode */
            newNode.content.appendChild(node.cloneNode(true));
            newNode.setAttribute("stmt", attr);
            node.replaceWith(newNode);
        }

        for(let attrName of node.getAttributeNames()) {

        }

        for (let curNode of node.children)
            this.parseRecursive(curNode);
    }

}