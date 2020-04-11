/**
 *
 * @return KtTpl
 */
function kt_tpl(selector) {
    if (selector instanceof KtTpl)
        return selector;
    let elem = document.getElementById(selector);
    if (elem instanceof KtTpl)
        return elem;
    throw `Selector '${selector}' is not a <kt-tpl> element`;
}