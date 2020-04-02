

class KtIf extends KT_Renderable {

    onAfterKtInit() {
        console.log("onKtInit()", this.outerHTML)
        let ktBlock = this.firstElementChild;

        if ( ! ktBlock instanceof KtBlock || typeof ktBlock !== "object") {
            console.error("Element child of x-kt-for must be x-kt-block in", this.outerHTML)
            throw "Element chilf of x-kt-for must be x-kt-block."
        }

        if ( ! this.hasAttribute("kt-id")) {
            this.setAttribute("kt-id", KT_DATA.length)
        }
        KT_DATA.push({origNode: ktBlock});

        for(let i = 0; i < this.children.length; i++)
            this.removeChild(this.children.item(0));
    }


    render(scope) {
        let stmt = this.getAttribute("stmt");

        let show = eval(stmt);

        if (show) {
            if (this.children.length === 0)
                this.appendChild(KT_DATA[this.getAttribute("kt-id")].origNode.cloneNode(true));

            this.renderRecursive(this.children.item(0), scope);
        }

        if ( ! show && this.hasChildNodes()) {

            for(let i = 0; i < this.children.length; i++)
                this.renderRecursive(this.children.item(0));
        }

    }


}

customElements.define("x-kt-if", KtIf);
