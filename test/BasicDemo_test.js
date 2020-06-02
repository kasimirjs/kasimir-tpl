Feature('render');

Scenario('BasicDemo', (I) => {
    I.amOnPage("/docs/basic-demos.html");
    I.waitForElement("#tbl1 > tbody > tr > td ", 1);
    I.see("hello", "#tbl1 td")

    I.click("#testpop");
    I.click("#testpop");
    I.see("No data", "#tbl1")
});
