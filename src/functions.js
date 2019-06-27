

/**
 *
 * @param templateSelector
 * @return {KasimirTemplate}
 */
function kasimir_tpl(templateSelector) {
    let tplElem = null;
    if (typeof templateSelector === "string") {
        tplElem = document.querySelector(templateSelector);
        if (tplElem === null)
            throw "kasimir_tpl(): can't find element '" + templateSelector + "'";
    } else if (templateSelector instanceof HTMLElement) {
        tplElem = templateSelector;
    } else {
        throw "kasimir_tpl(): parameter1 is not a HtmlElement";
    }
    let renderer = new KasimirRenderer();
    return renderer.render(tplElem);
}

