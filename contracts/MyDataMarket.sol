// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

contract MyDataMarket {
    uint256 public dataCount;

    struct DataAsset {
        uint256 id;
        address payable owner;
        string dbId;
        string tags;
        uint256 price;
        bool isSold;
    }

    mapping(uint256 => DataAsset) public dataAssets;
    mapping(uint256 => mapping(address => bool)) public hasPurchased;

    event DataRegistered(
        uint256 indexed id,
        address indexed owner,
        string dbId,
        string tags,
        uint256 price
    );
    event DataPurchased(uint256 indexed id, address indexed buyer, uint256 price);

    function registerData(
        string memory _dbId,
        string memory _tags,
        uint256 _price
    ) public {
        require(bytes(_dbId).length > 0, "dbId required");
        require(bytes(_tags).length > 0, "tags required");
        require(_price > 0, "price must be > 0");

        dataCount += 1;

        dataAssets[dataCount] = DataAsset({
            id: dataCount,
            owner: payable(msg.sender),
            dbId: _dbId,
            tags: _tags,
            price: _price,
            isSold: false
        });

        emit DataRegistered(dataCount, msg.sender, _dbId, _tags, _price);
    }

    function purchaseData(uint256 _id) public payable {
        require(_id > 0 && _id <= dataCount, "invalid data id");

        DataAsset storage asset = dataAssets[_id];

        require(msg.sender != asset.owner, "owner cannot buy own data");
        require(msg.value == asset.price, "incorrect price");
        require(!hasPurchased[_id][msg.sender], "already purchased");

        hasPurchased[_id][msg.sender] = true;
        asset.isSold = true;

        (bool success, ) = asset.owner.call{value: msg.value}("");
        require(success, "transfer failed");

        emit DataPurchased(_id, msg.sender, msg.value);
    }

    function checkAccess(uint256 _id, address _buyer) public view returns (bool) {
        require(_id > 0 && _id <= dataCount, "invalid data id");
        return hasPurchased[_id][_buyer];
    }
}

