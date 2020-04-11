

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
            let cloneNode = node.cloneNode(true)
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("forselect", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

        if (node.hasAttribute("*if")) {
            let newNode = document.createElement("template", {is: "kt-if"});
            let attr = node.getAttribute("*if");
            /* @var {HTMLTemplateElement} newNode */
            let cloneNode = node.cloneNode(true)
            newNode.content.appendChild(cloneNode);
            newNode.setAttribute("stmt", attr);
            node.replaceWith(newNode);
            node = cloneNode;
        }

        let cssClasses = [];
        let attrs = [];

        let regex = new RegExp("^\\[(.+)\\]$");
        for(let attrName of node.getAttributeNames()) {
            console.log("checking", attrName);

            let result = regex.exec(attrName);
            if (result === null)
                continue;

            console.log ("FOUNT")
            let split = result[1].split(".");
            console.log("found", split);
            if (split.length === 1) {
                attrs.push(`'${split[0]}': ` + node.getAttribute(attrName));
            } else {
                if (split[0] === "classlist")
                    cssClasses.push(`'${split[1]}': ` + node.getAttribute(attrName))
            }

        }

        console.log(cssClasses);

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