// filepath: /Users/senmu/Desktop/other-libs/geek-university-contract/ignition/modules/GeekCourseCertificate.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

/**
 * GeekCourseCertificate部署模块
 * 1. 部署GeekCourseCertificate合约
 * 构造函数会自动将部署者设置为ADMIN_ROLE和MINTER_ROLE
 */
export default buildModule("GeekCourseCertificate", (m) => {
  // 部署GeekCourseCertificate合约
  // 构造函数参数 "Geek Course Certificate" 和 "GeekCC" 是在合约中硬编码的，
  // 因此部署时不需要传递参数。
  const geekCourseCertificate = m.contract("GeekCourseCertificate", []);

  // 构造函数中已经处理了角色分配：
  // _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
  // _grantRole(MINTER_ROLE, msg.sender);
  // 因此，部署者自动拥有这些角色。

  // 返回部署的合约
  return { geekCourseCertificate };
});
