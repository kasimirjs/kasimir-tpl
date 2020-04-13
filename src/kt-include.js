

class KtInclude extends KtRenderable {


    constructor() {
        super();
        this.elements = null;
        this.params = {
            "src": null
        }
    }

    static get observedAttributes() {
        return ["src"];
    }

    attributeChangedCallback(attrName, oldVal, newVal) {
        this.params[attrName] = newVal;
    }


    loadRemote () {

    }


    _appendChildFromContent() {
        if (this.elements !== null)
            return;
        let newNode = this.content.cloneNode(true);
        this.elements = [];
        for (let curNode of newNode.childNodes) {
            curNode.ktOwner = "include";
            this.elements.push(curNode);
        }
        for (let i = this.elements.length-1; i>=0; i--) {
            this.parentElement.insertBefore(this.elements[i], this.nextSibling);
        }
    }

    _renderElements() {
        for (let curNode of this.elements)
            this.renderRecursive(curNode, context, true);
    }

    loadDataRemote() {
        let xhttp = new XMLHttpRequest();

        xhttp.open("GET", this.params.src);
        xhttp.onreadystatechange = () => {
            if (xhttp.readyState === 4) {
                if (xhttp.status >= 400) {
                    console.warn("Can't load '" + this.params.src + "': " + xhttp.responseText);
                    return;
                }
                this.innerHTML = xhttp.responseText;
                let p = new KtTemplateParser();
                p.parseRecursive(this.content);
                this._appendChildFromContent();
                this._renderElements();
                return;
            }

        };

        xhttp.send();
    }


    render(context) {
        if (this.elements === null)
            this.loadDataRemote();
        else
            this._renderElements();

    }
}

customElements.define("kt-include", KtInclude, {extends: "template"});