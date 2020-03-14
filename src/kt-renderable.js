
class KT_Renderable extends HTMLElement
{

    /**
     *
     * @param {HTMLElement} origNode
     */
    constructor(origNode) {
        super();

        this.origNode = origNode;
        /**
         *
         * @type {TplElem[]}
         */
        this.parentTpls = [];
    }

    render(scope) {
        for(let i = 0; i < this.parentTpls.length; i++) {
            this.parentTpls[i].render(scope);
        }
    }

}

