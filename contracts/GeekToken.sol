// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// 导入 OpenZeppelin 的 ERC20 标准合约
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
// 导入 OpenZeppelin 的所有权控制合约
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title GeekToken
 * @dev Geek University的ERC20代币实现
 * 代币用于课程购买和平台内激励机制
 */
contract GeekToken is ERC20, Ownable {
    // 定义 ETH 兑换 Geek 的比率：1 ETH = 1000 Geek
    uint256 public constant TOKENS_PER_ETH = 1000;
    // 定义代币最大供应量：125万 Geek（不包含小数位）
    uint256 public constant MAX_SUPPLY = 1250000;

    // 团队分配比例：20% = 25万 Geek
    uint256 public teamAllocation;
    // 市场营销分配比例：10% = 12.5万 Geek
    uint256 public marketingAllocation;
    // 社区分配比例：10% = 12.5万 Geek
    uint256 public communityAllocation;
    // 剩余 60% = 75万 Geek 用于公开销售

    // 标记初始代币分配是否已完成
    bool public initialDistributionDone;
    
    /**
     * @dev 重写decimals函数，将代币精度设置为0（整数代币）
     * @return 返回代币的小数位数
     */
    function decimals() public view virtual override returns (uint8) {
        return 0;
    }
    
    // 事件定义
    /**
     * @dev 当用户使用ETH购买代币时触发
     * @param buyer 购买者地址
     * @param ethAmount 支付的ETH数量
     * @param tokenAmount 购买的代币数量
     */
    event TokensPurchased(
        address indexed buyer,
        uint256 ethAmount,
        uint256 tokenAmount
    );
    
    /**
     * @dev 当用户卖出代币换回ETH时触发
     * @param seller 卖出者地址
     * @param tokenAmount 卖出的代币数量
     * @param ethAmount 获得的ETH数量
     */
    event TokensSold(
        address indexed seller,
        uint256 tokenAmount,
        uint256 ethAmount
    );
    
    /**
     * @dev 当初始代币分配完成时触发
     * @param teamWallet 团队钱包地址
     * @param marketingWallet 市场营销钱包地址
     * @param communityWallet 社区钱包地址
     */
    event InitialDistributionCompleted(
        address teamWallet,
        address marketingWallet,
        address communityWallet
    );

    /**
     * @dev 构造函数：初始化代币名称为 "Geek Token"，符号为 "Geek"
     * 同时计算各个分配额度
     */
    constructor() ERC20("Geek Token", "Geek") Ownable(msg.sender) {
        // 计算各个分配额度
        teamAllocation = (MAX_SUPPLY * 20) / 100; // 20% 分配给团队
        marketingAllocation = (MAX_SUPPLY * 10) / 100; // 10% 分配给市场营销
        communityAllocation = (MAX_SUPPLY * 10) / 100; // 10% 分配给社区
    }

    /**
     * @dev 初始代币分配函数，只能由合约所有者调用
     * 将代币按预设比例分配给团队、市场营销和社区钱包
     * @param teamWallet 团队钱包地址
     * @param marketingWallet 市场营销钱包地址
     * @param communityWallet 社区钱包地址
     */
    function distributeInitialTokens(
        address teamWallet, // 团队钱包地址
        address marketingWallet, // 市场营销钱包地址
        address communityWallet // 社区钱包地址
    ) external onlyOwner {
        require(!initialDistributionDone, "Initial distribution already done");

        _mint(teamWallet, teamAllocation); // 铸造团队份额
        _mint(marketingWallet, marketingAllocation); // 铸造市场营销份额
        _mint(communityWallet, communityAllocation); // 铸造社区份额

        initialDistributionDone = true;
        emit InitialDistributionCompleted(
            teamWallet,
            marketingWallet,
            communityWallet
        );
    }

    /**
     * @dev 使用ETH购买Geek代币的函数
     * 用户发送ETH到合约，按照TOKENS_PER_ETH比率获得代币
     */
    function buyWithETH() external payable {
        require(msg.value > 0, "Must send ETH");

      uint256 tokenAmount = (msg.value * TOKENS_PER_ETH) / 1 ether;
        require(
            totalSupply() + tokenAmount <= MAX_SUPPLY,
            "Would exceed max supply"
        );

        _mint(msg.sender, tokenAmount);
        emit TokensPurchased(msg.sender, msg.value, tokenAmount);
    }

    /**
     * @dev 将Geek代币卖回换取ETH
     * 用户可以将代币卖回合约，按照TOKENS_PER_ETH比率获得ETH
     * @param tokenAmount 要卖出的代币数量
     */
    function sellTokens(uint256 tokenAmount) external {
        require(tokenAmount > 0, "Amount must be greater than 0");
        require(balanceOf(msg.sender) >= tokenAmount, "Insufficient balance");

        // 计算ETH数量
        uint256 ethAmount = tokenAmount / TOKENS_PER_ETH;
        require(
            address(this).balance >= ethAmount,
            "Insufficient ETH in contract"
        );

        // 先销毁代币
        _burn(msg.sender, tokenAmount);

        // 发送ETH给用户
        (bool success, ) = payable(msg.sender).call{value: ethAmount}("");
        require(success, "ETH transfer failed");

        emit TokensSold(msg.sender, tokenAmount, ethAmount);
    }

    /**
     * @dev 查询剩余可铸造的代币数量
     * @return 返回还可以铸造的代币数量
     */
    function remainingMintableSupply() public view returns (uint256) {
        return MAX_SUPPLY - totalSupply();
    }

    /**
     * @dev 合约所有者提取合约中的ETH
     * 只有合约所有者可以调用此函数
     * 注意：实际应用中应考虑使用多签钱包作为所有者
     */
    function withdrawETH() external onlyOwner {
        //多签钱包应作为合约所有者，提高资金安全性
        payable(owner()).transfer(address(this).balance);
    }

    /**
     * @dev 允许合约直接接收ETH
     */
    receive() external payable {}

    /**
     * @dev 允许合约在调用不存在的函数时接收ETH
     */
    fallback() external payable {}
}