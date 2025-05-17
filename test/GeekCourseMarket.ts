// filepath: /Users/senmu/Desktop/other-libs/geek-university-contract/test/GeekCourseMarket.ts
import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre, { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { GeekToken, GeekCourseCertificate, GeekCourseMarket } from "../typechain-types";
import { EventLog } from "ethers"; // Import EventLog

const COURSE_WEB2_ID_1 = "COURSE_101";
const COURSE_NAME_1 = "Introduction to Solidity";
const COURSE_PRICE_1 = 100n; // 100 GEEK tokens

const COURSE_WEB2_ID_2 = "COURSE_102";
const COURSE_NAME_2 = "Advanced Smart Contracts";
const COURSE_PRICE_2 = 200n;

describe("GeekCourseMarket", function () {
  async function deployGeekCourseMarketFixture() {
    const [owner, student1, student2, courseCreatorAccount, otherUser] = await hre.ethers.getSigners();

    // Deploy GeekToken
    const GeekTokenFactory = await hre.ethers.getContractFactory("GeekToken");
    const geekToken = await GeekTokenFactory.deploy() as GeekToken;
    await geekToken.waitForDeployment();

    // Call distributeInitialTokens to ensure the owner (deployer) has tokens.
    // This mirrors the setup in the ignition module for GeekToken.
    // We assume owner receives tokens by being designated as the recipient wallets.
    await geekToken.connect(owner).distributeInitialTokens(
      owner.address, // teamWallet
      owner.address, // marketingWallet
      owner.address  // communityWallet
    );

    // Transfer some GEEK tokens to students for testing purchases
    // Now owner should have a balance.
    await geekToken.transfer(student1.address, 1000n);
    await geekToken.transfer(student2.address, 1000n);

    // Deploy GeekCourseCertificate
    const GeekCourseCertificateFactory = await hre.ethers.getContractFactory("GeekCourseCertificate");
    const geekCourseCertificate = await GeekCourseCertificateFactory.deploy() as GeekCourseCertificate;
    await geekCourseCertificate.waitForDeployment();

    // Deploy GeekCourseMarket
    const GeekCourseMarketFactory = await hre.ethers.getContractFactory("GeekCourseMarket");
    const geekCourseMarket = await GeekCourseMarketFactory.deploy(
      await geekToken.getAddress(),
      await geekCourseCertificate.getAddress()
    ) as GeekCourseMarket;
    await geekCourseMarket.waitForDeployment();

    // Grant MINTER_ROLE on GeekCourseCertificate to GeekCourseMarket contract
    // This allows GeekCourseMarket to mint certificates when verifying course completion
    const MINTER_ROLE = await geekCourseCertificate.MINTER_ROLE();
    await geekCourseCertificate.grantRole(MINTER_ROLE, await geekCourseMarket.getAddress());

    return {
      geekToken,
      geekCourseCertificate,
      geekCourseMarket,
      owner, // Deployer of all contracts, initial GEEK token holder, owner of GeekCourseMarket
      student1,
      student2,
      courseCreatorAccount, // Can be used if ownership of market is transferred or for specific creator tests
      otherUser,
      MINTER_ROLE, // On GeekCourseCertificate contract
    };
  }

  describe("Deployment", function () {
    it("Should set the correct GeekToken and GeekCourseCertificate addresses", async function () {
      const { geekCourseMarket, geekToken, geekCourseCertificate } = await loadFixture(deployGeekCourseMarketFixture);
      expect(await geekCourseMarket.geekToken()).to.equal(await geekToken.getAddress());
      expect(await geekCourseMarket.certificate()).to.equal(await geekCourseCertificate.getAddress());
    });

    it("Should set the deployer as the owner of GeekCourseMarket", async function () {
      const { geekCourseMarket, owner } = await loadFixture(deployGeekCourseMarketFixture);
      expect(await geekCourseMarket.owner()).to.equal(owner.address);
    });

    it("Should have initial courseCount as 0", async function () {
      const { geekCourseMarket } = await loadFixture(deployGeekCourseMarketFixture);
      expect(await geekCourseMarket.courseCount()).to.equal(0);
    });
  });

  describe("Course Management (Admin - Owner)", function () {
    describe("addCourse", function () {
      it("Should allow owner to add a new course", async function () {
        const { geekCourseMarket, owner } = await loadFixture(deployGeekCourseMarketFixture);

        await expect(
          geekCourseMarket.connect(owner).addCourse(COURSE_WEB2_ID_1, COURSE_NAME_1, COURSE_PRICE_1)
        )
          .to.emit(geekCourseMarket, "CourseAdded")
          .withArgs(1, COURSE_WEB2_ID_1, COURSE_NAME_1);

        const course = await geekCourseMarket.courses(1);
        expect(course.web2CourseId).to.equal(COURSE_WEB2_ID_1);
        expect(course.name).to.equal(COURSE_NAME_1);
        expect(course.price).to.equal(COURSE_PRICE_1);
        expect(course.isActive).to.be.true;
        expect(course.creator).to.equal(owner.address); // Creator is msg.sender (owner)
        expect(await geekCourseMarket.courseCount()).to.equal(1);
        expect(await geekCourseMarket.web2ToCourseId(COURSE_WEB2_ID_1)).to.equal(1);
      });

      it("Should revert if non-owner tries to add a course", async function () {
        const { geekCourseMarket, otherUser } = await loadFixture(deployGeekCourseMarketFixture);
        await expect(
          geekCourseMarket.connect(otherUser).addCourse(COURSE_WEB2_ID_1, COURSE_NAME_1, COURSE_PRICE_1)
        ).to.be.revertedWithCustomError(geekCourseMarket, "OwnableUnauthorizedAccount")
         .withArgs(otherUser.address);
      });

      it("Should revert if web2CourseId is empty", async function () {
        const { geekCourseMarket, owner } = await loadFixture(deployGeekCourseMarketFixture);
        await expect(
          geekCourseMarket.connect(owner).addCourse("", COURSE_NAME_1, COURSE_PRICE_1)
        ).to.be.revertedWith("Web2 course ID cannot be empty");
      });

      it("Should revert if course with the same web2CourseId already exists", async function () {
        const { geekCourseMarket, owner } = await loadFixture(deployGeekCourseMarketFixture);
        await geekCourseMarket.connect(owner).addCourse(COURSE_WEB2_ID_1, COURSE_NAME_1, COURSE_PRICE_1);
        await expect(
          geekCourseMarket.connect(owner).addCourse(COURSE_WEB2_ID_1, "Another Course", COURSE_PRICE_1)
        ).to.be.revertedWith("Course already exists");
      });
    });

    describe("updateCourse", function () {
      const NEW_WEB2_ID = "NEW_COURSE_ID_101_V2";
      const NEW_NAME = "Introduction to Solidity v2";
      const NEW_PRICE = ethers.parseEther("120");
      const NEW_IS_ACTIVE = false;

      beforeEach(async function () {
        // Load fixture and add a course for update tests
        const { geekCourseMarket, owner } = await loadFixture(deployGeekCourseMarketFixture);
        this.geekCourseMarket = geekCourseMarket;
        this.owner = owner;
        await this.geekCourseMarket.connect(this.owner).addCourse(COURSE_WEB2_ID_1, COURSE_NAME_1, COURSE_PRICE_1);
        this.courseId = await this.geekCourseMarket.web2ToCourseId(COURSE_WEB2_ID_1);
      });

      it("Should allow owner to update an existing course", async function () {
        await expect(
          this.geekCourseMarket.connect(this.owner).updateCourse(
            COURSE_WEB2_ID_1,
            NEW_WEB2_ID,
            NEW_NAME,
            NEW_PRICE,
            NEW_IS_ACTIVE
          )
        )
          .to.emit(this.geekCourseMarket, "CourseUpdated")
          .withArgs(this.courseId, COURSE_WEB2_ID_1, NEW_WEB2_ID, NEW_NAME, NEW_PRICE, NEW_IS_ACTIVE);

        const course = await this.geekCourseMarket.courses(this.courseId);
        expect(course.web2CourseId).to.equal(NEW_WEB2_ID);
        expect(course.name).to.equal(NEW_NAME);
        expect(course.price).to.equal(NEW_PRICE);
        expect(course.isActive).to.equal(NEW_IS_ACTIVE);
        expect(course.creator).to.equal(this.owner.address); // Creator should remain the same or be updated if logic changes

        expect(await this.geekCourseMarket.web2ToCourseId(COURSE_WEB2_ID_1)).to.equal(0); // Old ID mapping removed
        expect(await this.geekCourseMarket.web2ToCourseId(NEW_WEB2_ID)).to.equal(this.courseId); // New ID mapping added
      });

      it("Should revert if non-owner tries to update a course", async function () {
        const { otherUser } = await loadFixture(deployGeekCourseMarketFixture); // get fresh otherUser
        await expect(
          this.geekCourseMarket.connect(otherUser).updateCourse(
            COURSE_WEB2_ID_1, NEW_WEB2_ID, NEW_NAME, NEW_PRICE, NEW_IS_ACTIVE
          )
        ).to.be.revertedWithCustomError(this.geekCourseMarket, "OwnableUnauthorizedAccount")
         .withArgs(otherUser.address);
      });

      it("Should revert if oldWeb2CourseId is empty", async function () {
        await expect(
          this.geekCourseMarket.connect(this.owner).updateCourse(
            "", NEW_WEB2_ID, NEW_NAME, NEW_PRICE, NEW_IS_ACTIVE
          )
        ).to.be.revertedWith("Old Web2 course ID cannot be empty");
      });
      
      it("Should revert if newWeb2CourseId is empty", async function () {
        await expect(
          this.geekCourseMarket.connect(this.owner).updateCourse(
            COURSE_WEB2_ID_1, "", NEW_NAME, NEW_PRICE, NEW_IS_ACTIVE
          )
        ).to.be.revertedWith("New Web2 course ID cannot be empty");
      });

      it("Should revert if course (by oldWeb2CourseId) does not exist", async function () {
        await expect(
          this.geekCourseMarket.connect(this.owner).updateCourse(
            "NON_EXISTENT_ID", NEW_WEB2_ID, NEW_NAME, NEW_PRICE, NEW_IS_ACTIVE
          )
        ).to.be.revertedWith("Course does not exist");
      });

      it("Should allow updating a course to an existing web2CourseId if it's different from another course's ID", async function () {
        // Add a second course
        await this.geekCourseMarket.connect(this.owner).addCourse(COURSE_WEB2_ID_2, COURSE_NAME_2, COURSE_PRICE_2);
        
        // Try to update COURSE_101 to use COURSE_102's ID (this should fail if newWeb2CourseId is already mapped, unless it's the same courseId)
        // The current logic: web2ToCourseId[oldWeb2CourseId] = 0; web2ToCourseId[newWeb2CourseId] = courseId;
        // This means if newWeb2CourseId is already mapped to a *different* courseId, it will be overwritten.
        // The contract does not explicitly prevent updating to an existing web2CourseId of *another* course.
        // Let's test this behavior.
        
        // This should succeed, and COURSE_101's data will now be associated with COURSE_WEB2_ID_2
        // and the original COURSE_WEB2_ID_2 mapping will point to courseId of COURSE_101.
        // This might be an unintended behavior depending on requirements.
        // For now, testing the current implementation.
         await expect(
          this.geekCourseMarket.connect(this.owner).updateCourse(
            COURSE_WEB2_ID_1, // old ID of course 1
            COURSE_WEB2_ID_2, // new ID for course 1 (which is existing ID of course 2)
            NEW_NAME,
            NEW_PRICE,
            true
          )
        ).to.emit(this.geekCourseMarket, "CourseUpdated");

        const course1Data = await this.geekCourseMarket.courses(this.courseId); // courseId of original COURSE_WEB2_ID_1
        expect(course1Data.web2CourseId).to.equal(COURSE_WEB2_ID_2);

        expect(await this.geekCourseMarket.web2ToCourseId(COURSE_WEB2_ID_1)).to.equal(0);
        expect(await this.geekCourseMarket.web2ToCourseId(COURSE_WEB2_ID_2)).to.equal(this.courseId); // Now points to the first course's ID
      });
    });
  });

  // More tests to come for:
  // - Course Purchasing
  // - Course Completion and Certification
  // - hasCourse
  // - Batch operations
  // - Edge cases and security considerations
});
