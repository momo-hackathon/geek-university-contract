// filepath: /Users/senmu/Desktop/other-libs/geek-university-contract/test/GeekCourseCertificate.ts
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat"; // Import ethers from hardhat
import { EventLog } from "ethers"; // Import EventLog type directly
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GeekCourseCertificate } from "../typechain-types";

describe("GeekCourseCertificate", function () {
  // Define a fixture to deploy the contract
  async function deployGeekCourseCertificateFixture() {
    const [owner, student1, student2, minter, nonMinter] = await hre.ethers.getSigners();

    const GeekCourseCertificateFactory = await hre.ethers.getContractFactory("GeekCourseCertificate");
    const geekCourseCertificate = await GeekCourseCertificateFactory.deploy();
    // await geekCourseCertificate.deployed(); // Not needed with Hardhat Ignition/ethers v6

    // Grant MINTER_ROLE to the 'minter' account for testing role-based functions
    const MINTER_ROLE = await geekCourseCertificate.MINTER_ROLE();
    await geekCourseCertificate.grantRole(MINTER_ROLE, minter.address);

    return { geekCourseCertificate, owner, student1, student2, minter, nonMinter, MINTER_ROLE };
  }

  describe("Deployment", function () {
    it("Should set the correct name and symbol", async function () {
      const { geekCourseCertificate } = await loadFixture(deployGeekCourseCertificateFixture);
      expect(await geekCourseCertificate.name()).to.equal("Geek Course Certificate");
      expect(await geekCourseCertificate.symbol()).to.equal("GeekCC");
    });

    it("Should set the deployer as admin and minter", async function () {
      const { geekCourseCertificate, owner, MINTER_ROLE } = await loadFixture(deployGeekCourseCertificateFixture);
      const DEFAULT_ADMIN_ROLE = await geekCourseCertificate.DEFAULT_ADMIN_ROLE();
      expect(await geekCourseCertificate.hasRole(DEFAULT_ADMIN_ROLE, owner.address)).to.be.true;
      expect(await geekCourseCertificate.hasRole(MINTER_ROLE, owner.address)).to.be.true;
    });
  });

  describe("Minting Certificates", function () {
    const web2CourseId = "COURSE_ID_101";
    const metadataURI = "ipfs://example_uri_101";

    it("Should allow minter to mint a certificate", async function () {
      const { geekCourseCertificate, student1, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      await expect(geekCourseCertificate.connect(minter).mintCertificate(student1.address, web2CourseId, metadataURI))
        .to.emit(geekCourseCertificate, "CertificateMinted")
        .withArgs(1, web2CourseId, student1.address); // Assuming tokenId starts from 1

      expect(await geekCourseCertificate.ownerOf(1)).to.equal(student1.address);
      expect(await geekCourseCertificate.tokenURI(1)).to.equal(metadataURI);
      
      const certData = await geekCourseCertificate.certificates(1);
      expect(certData.web2CourseId).to.equal(web2CourseId);
      expect(certData.student).to.equal(student1.address);
      expect(certData.metadataURI).to.equal(metadataURI);

      expect(await geekCourseCertificate.hasCertificate(student1.address, web2CourseId)).to.be.true;
      const studentCerts = await geekCourseCertificate.getStudentCertificates(student1.address, web2CourseId);
      expect(studentCerts).to.deep.equal([1]);
    });

    it("Should increment token ID for each minted certificate", async function () {
      const { geekCourseCertificate, student1, student2, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      await geekCourseCertificate.connect(minter).mintCertificate(student1.address, "COURSE_A", "uri_A");
      const tokenId1 = await geekCourseCertificate.getStudentCertificates(student1.address, "COURSE_A").then(certs => certs[0]);
      
      await geekCourseCertificate.connect(minter).mintCertificate(student2.address, "COURSE_B", "uri_B");
      const tokenId2 = await geekCourseCertificate.getStudentCertificates(student2.address, "COURSE_B").then(certs => certs[0]);

      expect(tokenId1).to.not.equal(tokenId2);
      expect(tokenId2).to.equal(BigInt(tokenId1) + 1n); // Or check _tokenIds if it were public
    });

    it("Should revert if non-minter tries to mint", async function () {
      const { geekCourseCertificate, student1, nonMinter } = await loadFixture(deployGeekCourseCertificateFixture);
      const MINTER_ROLE = await geekCourseCertificate.MINTER_ROLE();
      await expect(geekCourseCertificate.connect(nonMinter).mintCertificate(student1.address, web2CourseId, metadataURI))
        .to.be.revertedWithCustomError(geekCourseCertificate, "AccessControlUnauthorizedAccount")
        .withArgs(nonMinter.address, MINTER_ROLE);
    });

    it("Should revert if minting to the zero address", async function () {
      const { geekCourseCertificate, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      await expect(geekCourseCertificate.connect(minter).mintCertificate(ethers.ZeroAddress, web2CourseId, metadataURI))
        .to.be.revertedWith("Invalid student address");
    });
  });

  describe("Token URI", function () {
    it("Should return the correct metadata URI", async function () {
      const { geekCourseCertificate, student1, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      const web2CourseId = "COURSE_ID_202";
      const metadataURI = "ipfs://example_uri_202";
      await geekCourseCertificate.connect(minter).mintCertificate(student1.address, web2CourseId, metadataURI);
      const tokenId = await geekCourseCertificate.getStudentCertificates(student1.address, web2CourseId).then(certs => certs[0]);
      expect(await geekCourseCertificate.tokenURI(tokenId)).to.equal(metadataURI);
    });

    it("Should revert when querying URI for a non-existent token", async function () {
      const { geekCourseCertificate } = await loadFixture(deployGeekCourseCertificateFixture);
      await expect(geekCourseCertificate.tokenURI(999))
        .to.be.revertedWithCustomError(geekCourseCertificate, "ERC721NonexistentToken")
        .withArgs(999);
    });
  });

  describe("Certificate Ownership and Retrieval", function () {
    const course1 = "COURSE_X";
    const course2 = "COURSE_Y";

    it("hasCertificate should return true if student has a certificate for a course", async function () {
      const { geekCourseCertificate, student1, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      await geekCourseCertificate.connect(minter).mintCertificate(student1.address, course1, "uri1");
      expect(await geekCourseCertificate.hasCertificate(student1.address, course1)).to.be.true;
    });

    it("hasCertificate should return false if student does not have a certificate for a course", async function () {
      const { geekCourseCertificate, student1, student2, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      await geekCourseCertificate.connect(minter).mintCertificate(student1.address, course1, "uri1");
      expect(await geekCourseCertificate.hasCertificate(student2.address, course1)).to.be.false;
      expect(await geekCourseCertificate.hasCertificate(student1.address, course2)).to.be.false;
    });

    it("getStudentCertificates should return correct token IDs for a student and course", async function () {
      const { geekCourseCertificate, student1, minter } = await loadFixture(deployGeekCourseCertificateFixture);
      const tx1 = await geekCourseCertificate.connect(minter).mintCertificate(student1.address, course1, "uri_c1_s1_1");
      const receipt1 = await tx1.wait();
      // Correctly cast log to EventLog to access args
      const event1 = receipt1?.logs.find((log: any) => log.fragment?.name === "CertificateMinted") as EventLog | undefined;
      const tokenId1 = event1?.args?.tokenId;

      const tx2 = await geekCourseCertificate.connect(minter).mintCertificate(student1.address, course1, "uri_c1_s1_2");
      const receipt2 = await tx2.wait();
      // Correctly cast log to EventLog to access args
      const event2 = receipt2?.logs.find((log: any) => log.fragment?.name === "CertificateMinted") as EventLog | undefined;
      const tokenId2 = event2?.args?.tokenId;

      const studentCerts = await geekCourseCertificate.getStudentCertificates(student1.address, course1);
      expect(studentCerts).to.have.lengthOf(2);
      expect(tokenId1).to.not.be.undefined;
      expect(tokenId2).to.not.be.undefined;
      expect(studentCerts).to.deep.include.members([tokenId1, tokenId2]);
    });

    it("getStudentCertificates should return an empty array if no certificates", async function () {
      const { geekCourseCertificate, student1 } = await loadFixture(deployGeekCourseCertificateFixture);
      expect(await geekCourseCertificate.getStudentCertificates(student1.address, course1)).to.deep.equal([]);
    });
  });

  describe("Access Control", function () {
    it("Admin should be able to grant MINTER_ROLE", async function () {
      const { geekCourseCertificate, owner, nonMinter, MINTER_ROLE } = await loadFixture(deployGeekCourseCertificateFixture);
      await geekCourseCertificate.connect(owner).grantRole(MINTER_ROLE, nonMinter.address);
      expect(await geekCourseCertificate.hasRole(MINTER_ROLE, nonMinter.address)).to.be.true;
    });

    it("Admin should be able to revoke MINTER_ROLE", async function () {
      const { geekCourseCertificate, owner, minter, MINTER_ROLE } = await loadFixture(deployGeekCourseCertificateFixture);
      await geekCourseCertificate.connect(owner).revokeRole(MINTER_ROLE, minter.address);
      expect(await geekCourseCertificate.hasRole(MINTER_ROLE, minter.address)).to.be.false;
    });

    it("Non-admin should not be able to grant MINTER_ROLE", async function () {
      const { geekCourseCertificate, student1, nonMinter, MINTER_ROLE } = await loadFixture(deployGeekCourseCertificateFixture);
      const DEFAULT_ADMIN_ROLE = await geekCourseCertificate.DEFAULT_ADMIN_ROLE();
      await expect(geekCourseCertificate.connect(student1).grantRole(MINTER_ROLE, nonMinter.address))
        .to.be.revertedWithCustomError(geekCourseCertificate, "AccessControlUnauthorizedAccount")
        .withArgs(student1.address, DEFAULT_ADMIN_ROLE);
    });
  });

  describe("Interface Support", function () {
    it("Should support ERC721 interface", async function () {
      const { geekCourseCertificate } = await loadFixture(deployGeekCourseCertificateFixture);
      // ERC721 interface ID is 0x80ac58cd
      expect(await geekCourseCertificate.supportsInterface("0x80ac58cd")).to.be.true;
    });

    it("Should support AccessControl interface", async function () {
      const { geekCourseCertificate } = await loadFixture(deployGeekCourseCertificateFixture);
      // AccessControl interface ID is 0x7965db0b
      expect(await geekCourseCertificate.supportsInterface("0x7965db0b")).to.be.true;
    });

    it("Should not support a random interface", async function () {
      const { geekCourseCertificate } = await loadFixture(deployGeekCourseCertificateFixture);
      expect(await geekCourseCertificate.supportsInterface("0x12345678")).to.be.false;
    });
  });
});
