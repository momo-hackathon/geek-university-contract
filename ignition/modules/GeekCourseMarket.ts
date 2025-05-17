// filepath: /Users/senmu/Desktop/other-libs/geek-university-contract/ignition/modules/GeekCourseMarket.ts
import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";
import GeekTokenModule from "./GeekToken";
import GeekCourseCertificateModule from "./GeekCourseCertificate";

/**
 * GeekCourseMarket部署模块
 * 1. 依赖GeekTokenModule和GeekCourseCertificateModule
 * 2. 获取已部署的GeekToken和GeekCourseCertificate合约实例
 * 3. 部署GeekCourseMarket合约，并传入依赖合约的地址
 */
export default buildModule("GeekCourseMarket", (m) => {
  // 从GeekTokenModule获取已部署的GeekToken合约实例
  const { geekToken } = m.useModule(GeekTokenModule);

  // 从GeekCourseCertificateModule获取已部署的GeekCourseCertificate合约实例
  const { geekCourseCertificate } = m.useModule(GeekCourseCertificateModule);

  // 部署GeekCourseMarket合约
  // 构造函数需要GeekToken和GeekCourseCertificate的地址作为参数
  const geekCourseMarket = m.contract("GeekCourseMarket", [
    geekToken,
    geekCourseCertificate,
  ]);

  // 返回部署的合约
  return { geekCourseMarket };
});
