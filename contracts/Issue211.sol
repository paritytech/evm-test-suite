contract Issue211 {
    function f() external payable {}

    function call() public payable {
        this.f{value: 10}();
    }
}
