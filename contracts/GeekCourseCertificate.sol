// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

// 导入所需的 OpenZeppelin 合约
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title GeekCourseCertificate
 * @dev Geek课程证书NFT合约，用于发放课程完成证书
 * 实现了ERC721标准和访问控制功能
 */
contract GeekCourseCertificate is ERC721, AccessControl {
    using Strings for uint256;

    // NFT ID计数器，用于生成唯一的证书ID
    uint256 private _tokenIds;


    // 定义铸造者角色，只有拥有该角色才能铸造证书
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    /**
     * @dev 证书数据结构，存储每个证书的详细信息
     * @param web2CourseId Web2平台的课程ID，用于关联线上课程
     * @param student 学生地址，证书的所有者
     * @param timestamp 发放时间，记录证书颁发的区块时间戳
     * @param metadataURI 元数据URI，指向证书的详细信息和图像
     */
    struct CertificateData {
        string web2CourseId; // Web2平台的课程ID
        address student; // 学生地址
        uint256 timestamp; // 发放时间
        string metadataURI; // 元数据URI
    }

    // tokenId => 证书数据，存储所有证书的详细信息
    mapping(uint256 => CertificateData) public certificates;

    // 记录学生获得的证书：courseId => 学生地址 => tokenId数组
    // 允许一个学生对同一课程拥有多个证书（如不同版本或重修）
    mapping(string => mapping(address => uint256[])) public studentCertificates;

    /**
     * @dev 证书铸造事件，当新证书被创建时触发
     * @param tokenId 证书的唯一ID
     * @param web2CourseId 关联的Web2课程ID
     * @param student 获得证书的学生地址
     */
    event CertificateMinted(
        uint256 indexed tokenId,
        string web2CourseId,
        address indexed student
    );

    /**
     * @dev 构造函数，初始化NFT名称和符号
     * 同时授予合约部署者管理员和铸造者权限
     */
    constructor() ERC721("Geek Course Certificate", "GeekCC") {
        // 授予合约部署者管理员和铸造者权限
        _grantRole(DEFAULT_ADMIN_ROLE, msg.sender);
        _grantRole(MINTER_ROLE, msg.sender);
    }

    /**
     * @dev 铸造新的课程证书
     * 只有拥有MINTER_ROLE角色的地址才能调用此函数
     * @param student 学生地址，证书将被铸造给该地址
     * @param web2CourseId 课程ID，关联Web2平台的课程
     * @param metadataURI 元数据URI，指向证书的详细信息
     * @return uint256 新铸造的证书ID
     */
    function mintCertificate(
        address student,
        string memory web2CourseId,
        string memory metadataURI
    ) external onlyRole(MINTER_ROLE) returns (uint256) {
        require(student != address(0), "Invalid student address");

        // 生成新的tokenId
        _tokenIds++; // 直接对 uint256 进行自增
        uint256 newTokenId = _tokenIds; // 获取当前 tokenId

        // 铸造NFT
        _safeMint(student, newTokenId);

        // 存储证书数据
        certificates[newTokenId] = CertificateData({
            web2CourseId: web2CourseId,
            student: student,
            timestamp: block.timestamp,
            metadataURI: metadataURI
        });

        // 记录学生的证书
        studentCertificates[web2CourseId][student].push(newTokenId);

        emit CertificateMinted(newTokenId, web2CourseId, student);
        return newTokenId;
    }

    /**
     * @dev 获取证书元数据URI
     * 重写ERC721的tokenURI函数，返回证书的元数据URI
     * @param tokenId 证书ID
     * @return string 证书的元数据URI
     */
    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId); // 使用 _requireOwned 检查 token 是否存在，如果不存在会自动 revert
        return certificates[tokenId].metadataURI;
    }

    /**
     * @dev 检查学生是否拥有某课程的证书
     * @param student 学生地址
     * @param web2CourseId 课程ID
     * @return bool 如果学生拥有该课程的证书则返回true
     */
    function hasCertificate(
        address student,
        string memory web2CourseId
    ) public view returns (bool) {
        return studentCertificates[web2CourseId][student].length > 0;
    }

    /**
     * @dev 获取学生某课程的所有证书ID
     * @param student 学生地址
     * @param web2CourseId 课程ID
     * @return uint256[] 学生拥有的该课程的所有证书ID数组
     */
    function getStudentCertificates(
        address student,
        string memory web2CourseId
    ) public view returns (uint256[] memory) {
        return studentCertificates[web2CourseId][student];
    }

    /**
     * @dev 实现 supportsInterface 函数
     * 由于同时继承了ERC721和AccessControl，需要正确处理接口支持
     * @param interfaceId 接口ID
     * @return bool 如果合约支持该接口则返回true
     */
    function supportsInterface(
        bytes4 interfaceId
    ) public view override(ERC721, AccessControl) returns (bool) {
        return super.supportsInterface(interfaceId);
    }
}