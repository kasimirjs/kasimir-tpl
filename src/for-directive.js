class KT_ForDirective extends KT_Renderable {

    constructor() {
        super();
        // console.log("construct", this.outerHTML);
        this.state.len = 0;
    }


    onKtInit() {

    }

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

    connectedCallback() {
    }

    disconnectedCallback() {
        console.log("disconnected", this.outerHTML);
    }

    render(scope) {
        let ktId = parseInt(this.getAttribute("kt-id"));
        let result = new RegExp("let (\\w+) of ([a-zA-Z0-9_.]+)");
        result = result.exec(this.getAttribute("for"));

        let selector = result[2];
        let target = result[1];

        let val = scope[selector];

        //console.log("render() scope: ", scope, "value:", val);

        // Create new elements
        for (let i = this.state.len; i < val.length; i++) {
            //console.log("append",  "to", this.outerHTML, this.state);
            let e = KT_DATA[ktId].origNode.cloneNode(true);
            // this.ownerDocument.adoptNode(e);

            this.append(e);
            this.state.len++;
        }


        for (let i = 0; i < val.length; i++) {
            //console.log ("Refresh", i, `with scope[${target}] = '${val[i]}'`);
            scope[target] = val[i];
            scope["idx"] = i;
            let curNode = this.children.item(i);
            //console.log ("node is", curNode, this.children);
            curNode.render(scope);
        }


        for (let i = this.state.len; i > val.length; i--) {
            //    let c = this.state.parentTpls.pop();
            this.removeChild(this.lastElementChild);
            this.state.len--;
        }

    }

}

customElements.define("x-kt-for", KT_ForDirective);