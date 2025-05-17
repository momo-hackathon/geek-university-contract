// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "./GeekToken.sol";
import "./GeekCourseCertificate.sol";

/**
 * @title CourseMarket
 * @dev Geek课程市场合约
 * 管理课程的添加、购买和完成认证流程
 */
contract GeekCourseMarket is Ownable {
    // 合约实例
    GeekToken public geekToken;      // Geek代币合约实例
    GeekCourseCertificate public certificate; // 证书NFT合约实例

    /**
     * @dev 课程结构体，存储课程的详细信息
     * @param web2CourseId Web2平台的课程ID，用于关联线上课程
     * @param name 课程名称
     * @param price 课程价格(Geek代币)
     * @param isActive 课程是否可购买
     * @param creator 课程创建者地址，接收课程购买收入
     */
    struct Course {
        string web2CourseId; // Web2平台的课程ID
        string name; // 课程名称
        uint256 price; // 课程价格(Geek代币)
        bool isActive; // 课程是否可购买
        address creator; // 课程创建者地址
    }

    // 合约状态变量
    mapping(uint256 => Course) public courses; // courseId => Course，存储所有课程
    mapping(string => uint256) public web2ToCourseId; // web2CourseId => courseId，Web2课程ID到链上ID的映射
    mapping(address => mapping(uint256 => bool)) public userCourses; // 用户购买记录：用户地址 => 课程ID => 是否已购买
    uint256 public courseCount; // 课程总数，同时用作新课程的ID

    /**
     * @dev 课程购买事件，当用户购买课程时触发
     * @param buyer 购买者地址
     * @param courseId 课程ID
     * @param web2CourseId Web2平台的课程ID
     */
    event CoursePurchased(
        address indexed buyer,
        uint256 indexed courseId,
        string web2CourseId
    );
    
    /**
     * @dev 课程完成事件，当学生完成课程并获得证书时触发
     * @param student 学生地址
     * @param courseId 课程ID
     * @param certificateId 颁发的证书ID
     */
    event CourseCompleted(
        address indexed student,
        uint256 indexed courseId,
        uint256 certificateId
    );
    
    /**
     * @dev 课程添加事件，当新课程被添加到市场时触发
     * @param courseId 课程ID
     * @param web2CourseId Web2平台的课程ID
     * @param name 课程名称
     */
    event CourseAdded(
        uint256 indexed courseId,
        string web2CourseId,
        string name
    );

    event CourseUpdated(
        uint256 indexed courseId,
        string oldWeb2CourseId,
        string newWeb2CourseId,
        string name,
        uint256 price,
        bool isActive
    );

    /**
     * @dev 构造函数
     * @param _tokenAddress Geek代币合约地址
     * @param _certificateAddress 证书NFT合约地址
     */
    constructor(address _tokenAddress, address _certificateAddress) Ownable(msg.sender) {
        geekToken = GeekToken(payable(_tokenAddress));
        certificate = GeekCourseCertificate(payable(_certificateAddress));
    }

    /**
     * @dev 添加新课程到市场
     * 只有合约所有者可以调用此函数
     * @param web2CourseId Web2平台的课程ID
     * @param name 课程名称
     * @param price 课程价格(Geek代币)
     */
    function addCourse(
        string memory web2CourseId,
        string memory name,
        uint256 price
    ) external onlyOwner {
        require(
            bytes(web2CourseId).length > 0,
            "Web2 course ID cannot be empty"
        );
        require(web2ToCourseId[web2CourseId] == 0, "Course already exists");

        courseCount++;

        courses[courseCount] = Course({
            web2CourseId: web2CourseId,
            name: name,
            price: price,
            isActive: true,
            creator: msg.sender
        });

        web2ToCourseId[web2CourseId] = courseCount;

        emit CourseAdded(courseCount, web2CourseId, name);
    }

    /**
     * @dev 修改课程
     * 只有合约所有者可以调用此函数
     * @param oldWeb2CourseId 旧的Web2平台的课程ID
     * @param newWeb2CourseId 新的Web2平台的课程ID
     * @param name 课程名称
     * @param price 课程价格(Geek代币)
     */
    function updateCourse(
        string memory oldWeb2CourseId,
        string memory newWeb2CourseId,
        string memory name,
        uint256 price,
        bool isActive
    ) external onlyOwner {
        require(
            bytes(oldWeb2CourseId).length > 0,
            "Old Web2 course ID cannot be empty"
        );
        require(
            bytes(newWeb2CourseId).length > 0,
            "New Web2 course ID cannot be empty"
        );

        uint256 courseId = web2ToCourseId[oldWeb2CourseId];
        require(courseId > 0, "Course does not exist");

        courses[courseId] = Course({
            web2CourseId: newWeb2CourseId,
            name: name,
            price: price,
            isActive: isActive,
            creator: msg.sender
        });

        web2ToCourseId[oldWeb2CourseId] = 0;
        web2ToCourseId[newWeb2CourseId] = courseId;
        emit CourseUpdated(courseId, oldWeb2CourseId, newWeb2CourseId, name, price, isActive);
    }

    /**
     * @dev 用户购买课程
     * 用户需要先授权合约使用其Geek代币
     * @param web2CourseId Web2平台的课程ID
     */
    function purchaseCourse(string memory web2CourseId) external {
        uint256 courseId = web2ToCourseId[web2CourseId];
        require(courseId > 0, "Course does not exist");

        Course memory course = courses[courseId];
        require(course.isActive, "Course not active");
        require(!userCourses[msg.sender][courseId], "Already purchased");

        // 转移代币从用户到课程创建者
        require(
            geekToken.transferFrom(msg.sender, course.creator, course.price),
            "Transfer failed"
        );

        userCourses[msg.sender][courseId] = true;
        emit CoursePurchased(msg.sender, courseId, web2CourseId);
    }

    /**
     * @dev 验证课程完成并发放证书
     * 只有合约所有者可以调用此函数，确认学生已完成课程
     * @param student 学生地址
     * @param web2CourseId Web2平台的课程ID
     */
    function verifyCourseCompletion(
        address student,
        string memory web2CourseId
    ) external onlyOwner {
        uint256 courseId = web2ToCourseId[web2CourseId];
        require(courseId > 0, "Course does not exist");
        require(userCourses[student][courseId], "Course not purchased");
        require(
            !certificate.hasCertificate(student, web2CourseId),
            "Certificate already issued"
        );

        // 生成证书元数据URI
        string memory metadataURI = generateCertificateURI(
            student,
            web2CourseId
        );
        
        // 铸造证书NFT
        uint256 tokenId = certificate.mintCertificate(
            student,
            web2CourseId,
            metadataURI
        );

        emit CourseCompleted(student, courseId, tokenId);
    }

    /**
     * @dev 批量验证课程完成
     * 允许一次性为多个学生验证课程完成并发放证书
     * @param students 学生地址数组
     * @param web2CourseId Web2平台的课程ID
     */
    function batchVerifyCourseCompletion(
        address[] memory students,
        string memory web2CourseId
    ) external onlyOwner {
        for (uint256 i = 0; i < students.length; i++) {
            // 检查学生是否已购买课程且尚未获得证书
            if (
                userCourses[students[i]][web2ToCourseId[web2CourseId]] &&
                !certificate.hasCertificate(students[i], web2CourseId)
            ) {
                // 使用 this 关键字调用 external 函数
                this.verifyCourseCompletion(students[i], web2CourseId);
            }
        }
    }

    /**
     * @dev 检查用户是否已购买课程
     * @param user 用户地址
     * @param web2CourseId Web2平台的课程ID
     * @return bool 如果用户已购买该课程则返回true
     */
    function hasCourse(
        address user,
        string memory web2CourseId
    ) external view returns (bool) {
        uint256 courseId = web2ToCourseId[web2CourseId];
        require(courseId > 0, "Course does not exist");
        return userCourses[user][courseId];
    }

    /**
     * @dev 生成证书元数据URI
     * 创建指向证书元数据的URI，包含课程ID和学生地址
     * @param student 学生地址
     * @param web2CourseId Web2平台的课程ID
     * @return string 生成的元数据URI
     */
    function generateCertificateURI(
        address student,
        string memory web2CourseId
    ) internal pure returns (string memory) {
        return
            string(
                abi.encodePacked(
                    "https://api.geek.com/certificate/",
                    web2CourseId,
                    "/",
                    Strings.toHexString(student)
                )
            );
    }
}