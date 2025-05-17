import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import { parseEther } from "ethers";

/**
 * GeekToken部署和初始化模块
 * 包括：
 * 1. 部署GeekToken合约
 * 2. 执行初始代币分配
 * 3. 可选：添加ETH进行代币流动性初始化
 */
export default buildModule("GeekToken", (m) => {
  // 部署GeekToken合约 - 不需要构造函数参数，因为合约中已经设置了名称和符号
  const geekToken = m.contract("GeekToken", []);
  const deployerAccount = m.getAccount(0);

  // 定义钱包地址
  const teamWallet = deployerAccount; // 使用第一个账户作为团队钱包
  const marketingWallet = deployerAccount; // 使用第二个账户作为营销钱包
  const communityWallet = deployerAccount; // 使用第三个账户作为社区钱包
  
  // 执行初始代币分配
  const distributionTx = m.call(
    geekToken,
    "distributeInitialTokens",
    [teamWallet, marketingWallet, communityWallet],
    { id: "distributeInitialTokens" }
  );

  // 可选：向合约添加ETH以支持代币卖回功能
  // 添加1 ETH作为初始流动性
  // m.call(
  //   geekToken,
  //   "buyWithETH",
  //   [],
  //   { 
  //     value: parseEther("0.1"), // 发送0.1 ETH到合约
  //     id: "addInitialLiquidity",
  //     after: [distributionTx] // 设置交易依赖关系：先进行代币分配，然后添加流动性
  //   }
  // );

  // 返回部署的合约
  return { geekToken };
});