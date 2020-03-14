class KT_ForDirective extends KT_Renderable {

    constructor() {
        super();
    }

    static applies(node) {
        return node.hasAttribute("ngFor");
    }

    /**
     *
     * @param {this} instane
     * @param {HTMLElement} node
     */
    static apply (instane, node) {
        let stmt = node.getAttribute("ngFor");



        console.log(result);

    }

    render(scope) {
        let result = new RegExp("let (\\w+) of ([a-zA-Z0-9_.]+)");
        result = result.exec(this.state.ngFor);

        let selector = result[2];
        let target = result[1];

        let val = scope[selector];
        console.log("render for", selector, scope, val);
        // Create new elements
        for (let i = this.state.parentTpls.length; i < val.length; i++) {
            let e = this.state.origNode.cloneNode(true);

            this.state.parentTpls.push(e);
            this.appendChild(e);

            console.log("append", e, this.state.parentTpls);

        }
        for (let i = 0; i < val.length; i++) {
            scope[target] = val[i];
            scope["idx"] = i;
            this.state.parentTpls[i].render(scope);
        }

    }

}

customElements.define("x-kt-for-directive", KT_ForDirective);