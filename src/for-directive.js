class KT_ForDirective extends KT_Renderable {

    constructor(node) {
        super(node);
        this.ngFor = node.getAttribute("ngFor");
    }

    applies(node) {
        return node.hasAttribute("ngFor");
    }

    render(scope) {
        super.render(scope);
    }

}