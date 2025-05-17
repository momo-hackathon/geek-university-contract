# geek-university-contract

web3 university contract

## 项目概述

`geek-university-contract` 是一个基于以太坊的智能合约项目，旨在为 Geek University 提供一个去中心化的课程市场和证书发行平台。该项目包含三个核心合约：

* `GeekToken.sol`: Geek University 的 ERC20 代币，用于课程购买和平台激励。
* `GeekCourseCertificate.sol`: ERC721 标准的 NFT 合约，用于发放课程结业证书。
* `GeekCourseMarket.sol`: 课程市场合约，管理课程的发布、购买以及完成后的证书发放流程。

## 合约详情

### 1. `GeekToken.sol`

* **类型**: ERC20, Ownable
* **代币名称**: Geek Token
* **代币符号**: Geek
* **小数位数**: 0 (整数代币)
* **最大供应量**: 1,250,000 Geek
* **功能**:
  * 允许用户使用 ETH 购买 Geek Token。
  * 允许用户卖出 Geek Token换回 ETH。
  * 合约所有者可以进行初始代币分配，将代币按比例分配给团队、市场营销和社区钱包。
* **事件**:
  * `TokensPurchased`: 用户购买代币时触发。
  * `TokensSold`: 用户卖出代币时触发。
  * `InitialDistributionCompleted`: 初始代币分配完成时触发。

### 2. `GeekCourseCertificate.sol`

* **类型**: ERC721, AccessControl
* **NFT 名称**: Geek Course Certificate
* **NFT 符号**: GeekCC
* **功能**:
  * 允许拥有 `MINTER_ROLE` 角色的地址铸造新的课程证书 NFT。
  * 每个证书包含 Web2 平台的课程 ID、学生地址、发放时间戳和元数据 URI。
  * 提供查询学生是否拥有特定课程证书以及获取学生所有证书的功能。
* **核心结构体**:
  * `CertificateData`: 存储证书的详细信息。
* **核心映射**:
  * `certificates`: tokenId 到证书数据的映射。
  * `studentCertificates`: 课程 ID 和学生地址到其拥有的证书 tokenId 数组的映射。
* **事件**:
  * `CertificateMinted`: 新证书被铸造时触发。

### 3. `GeekCourseMarket.sol`

* **类型**: Ownable
* **依赖合约**: `GeekToken`, `GeekCourseCertificate`
* **功能**:
  * **课程管理**:
    * 合约所有者可以添加新课程，定义 Web2 课程 ID、名称和价格（以 Geek Token 定价）。
    * 合约所有者可以修改现有课程信息，包括 Web2 课程 ID、名称、价格和激活状态。
  * **课程购买**:
    * 用户可以购买已激活的课程，需要预先授权合约使用其 Geek Token。
    * 购买成功后，记录用户购买信息。
  * **课程完成与证书发放**:
    * 合约所有者可以验证学生是否完成课程。
    * 验证通过后，调用 `GeekCourseCertificate` 合约铸造并向学生发放课程证书 NFT。
    * 支持批量验证课程完成。
  * **查询**:
    * 可以查询用户是否已购买特定课程。
* **核心结构体**:
  * `Course`: 存储课程的详细信息，包括 Web2 课程 ID、名称、价格、激活状态和创建者。
* **核心映射**:
  * `courses`: 链上课程 ID 到课程信息的映射。
  * `web2ToCourseId`: Web2 课程 ID 到链上课程 ID 的映射。
  * `userCourses`: 用户地址和课程 ID 到购买状态的映射。
* **事件**:
  * `CoursePurchased`: 用户购买课程时触发。
  * `CourseCompleted`: 学生完成课程并获得证书时触发。
  * `CourseAdded`: 新课程被添加到市场时触发。
  * `CourseUpdated`: 课程信息被修改时触发。

## 如何使用

### 环境要求

* Node.js
* pnpm
* Hardhat

### 安装依赖

```bash
pnpm install
```

### 编译合约

```bash
npx hardhat compile
```

### 运行测试

```bash
npx hardhat test
```

### 部署合约

部署脚本位于 `ignition/modules/` 目录下。

例如，部署 `GeekToken` 合约：

```bash
npx hardhat ignition deploy ignition/modules/GeekToken.ts --network <your_network_name>
```

请将 `<your_network_name>` 替换为 Hardhat 配置文件中定义的网络名称 (例如 `sepolia`, `localhost`)。

## 贡献

欢迎对此项目进行贡献。请通过提交 Pull Request 的方式参与。

## 许可证

该项目使用 ISC 许可证。详情请见 `LICENSE` 文件。
