const BigNumber = web3.BigNumber;
const LinkedListMock = artifacts.require('LinkedListMock.sol');

require('chai')
  .use(require('chai-bignumber')(BigNumber))
  .should();

const NULL = '0x0000000000000000000000000000000000000000';
const HEAD = '0x0000000000000000000000000000000000000000';
const PREV = false;
const NEXT = true;

const ADDRESSES = [
    '0x8456cd48030b7b3cb2ae7ec7c1d74cbba58cb693',
    '0x5c7784b553465dcd0cfd1a36681bb1a69ac71b29',
    '0xce103efebf678aaf23073a4db8022bfcb004ee5a',
    '0x6cd7917aaa9ac56acc06704d0d64ac0e42c669a7',
    '0xd509c56628cc1b3278044ffcad84b7ab0a0f868b',
    '0x85ad97a43862560159bf511695631b0c75eb28c3',
    '0x4b7a746bc6247cb40c9296d5012b8bf92a03ab26',
    '0x4f2b82633c352389d109834e269e7d131b135b7d',
    '0x8c83e1b66882b06e857806dec787361ea699ad22',
];

async function sizeShouldBe(linkedList, expectedSize) {
    const size = await linkedList.sizeOf();
    size.should.be.bignumber.equal(new BigNumber(size), `The size of the linked list should be ${expectedSize}!`);
}

contract.only('LinkedListMock', () => {
    beforeEach(async function() {
        this.linkedList = await LinkedListMock.new();
    });

    describe('the list is empty', function() {
        describe('.listExists', function() {
            it('returns false', async function() {
                const listExists = await this.linkedList.listExists();
                listExists.should.be.equal(false, 'The list is empty so listExists should be false!');
            });
        });
        
        describe('.sizeOf ', function() {
            it('returns 0', async function() {
                await sizeShouldBe(this.linkedList, 0);
            });
        });

        describe('.insert', function() {
            it('inserts correctly', async function() {
                await this.linkedList.insert(HEAD,ADDRESSES[0],NEXT);
        
                const listExists = await this.linkedList.listExists();
                listExists.should.be.equal(true, 'The list has one element so listExists should be true!');
        
                await sizeShouldBe(this.linkedList, 1);
            
                const nodeExists = await this.linkedList.nodeExists(ADDRESSES[0]);
                nodeExists.should.be.equal(true, 'The inserted node should exist after insertion!');
            });
        });
    });

    describe('the list is non-empty', function() {
        beforeEach(async function() {
            await this.linkedList.insert(HEAD,ADDRESSES[0],NEXT);
            await this.linkedList.insert(ADDRESSES[0],ADDRESSES[1],NEXT);
            await this.linkedList.insert(ADDRESSES[1],ADDRESSES[2],NEXT);
            await this.linkedList.insert(ADDRESSES[2],ADDRESSES[3],NEXT);
            await this.linkedList.insert(ADDRESSES[3],ADDRESSES[4],NEXT);
        });

        describe('.insert', function() {
            it('inserts correctly at beginning', async function() {
                await this.linkedList.insert(ADDRESSES[0],ADDRESSES[5],PREV);
                await sizeShouldBe(this.linkedList, 6);
            
                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[5]);
                nodeExists.should.be.equal(true, 'The inserted node should exist after insertion!');
                prevNode.should.be.equal(HEAD, 'The previous node should be HEAD!');
                nextNode.should.be.equal(ADDRESSES[0], `The next node should be ${ADDRESSES[0]}!`);
    
                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[7]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of non-inserted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of non-inserted node should be HEAD!');

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(ADDRESSES[0]);
                node2Exists.should.be.equal(true, 'The referenced node should still exist after insertion!');
                prev2Node.should.be.equal(ADDRESSES[5], `The previous node of reference should be ${ADDRESSES[5]}!`);
                next2Node.should.be.equal(ADDRESSES[1], `The next node of reference should be ${ADDRESSES[1]}!`);
            });

            it('inserts correctly in the middle', async function() {
                await this.linkedList.insert(ADDRESSES[2],ADDRESSES[5],NEXT);
                await sizeShouldBe(this.linkedList, 6);
            
                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[5]);
                nodeExists.should.be.equal(true, 'The inserted node should exist after insertion!');
                prevNode.should.be.equal(ADDRESSES[2], `The previous node should be ${ADDRESSES[2]}!`);
                nextNode.should.be.equal(ADDRESSES[3], `The previous node should be ${ADDRESSES[3]}!`);
    
                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[7]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of non-inserted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of non-inserted node should be HEAD!');

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(ADDRESSES[2]);
                node2Exists.should.be.equal(true, 'The referenced node should still exist after insertion!');
                prev2Node.should.be.equal(ADDRESSES[1], `The previous node of reference should be ${ADDRESSES[1]}!`);
                next2Node.should.be.equal(ADDRESSES[5], `The next node of reference should be ${ADDRESSES[5]}!`);
            });

            it('inserts correctly at end', async function() {
                await this.linkedList.insert(ADDRESSES[4],ADDRESSES[5],NEXT);
                await sizeShouldBe(this.linkedList, 6);
            
                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[5]);
                nodeExists.should.be.equal(true, 'The inserted node should exist after insertion!');
                prevNode.should.be.equal(ADDRESSES[4], `The previous node should be ${ADDRESSES[0]}!`);
                nextNode.should.be.equal(HEAD, 'The next node should be HEAD!');
    
                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[7]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of non-inserted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of non-inserted node should be HEAD!');

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(ADDRESSES[4]);
                node2Exists.should.be.equal(true, 'The referenced node should still exist after insertion!');
                prev2Node.should.be.equal(ADDRESSES[3], `The previous node of reference should be ${ADDRESSES[3]}!`);
                next2Node.should.be.equal(ADDRESSES[5], `The next node of reference should be ${ADDRESSES[5]}!`);
            });
        });

        describe('.getAdjacent', function() {
            it('finds the correct neighbor for first element in PREV direction', async function() {
                const [nodeExists, neighbor] = await this.linkedList.getAdjacent(ADDRESSES[0], PREV);
                nodeExists.should.be.equal(true, 'The node should exist!');
                neighbor.should.be.equal(HEAD, `The previous neighbor of first element should be HEAD!`);                
            });

            it('finds the correct neighbor for first element in NEXT direction', async function() {
                const [nodeExists, neighbor] = await this.linkedList.getAdjacent(ADDRESSES[0], NEXT);
                nodeExists.should.be.equal(true, 'The node should exist!');
                neighbor.should.be.equal(ADDRESSES[1], `The next neighbor of first element should be ${ADDRESSES[1]}!`);
            });

            it('finds the correct neighbor for last element in PREV direction', async function() {
                const [nodeExists, neighbor] = await this.linkedList.getAdjacent(ADDRESSES[4], PREV);
                nodeExists.should.be.equal(true, 'The node should exist!');
                neighbor.should.be.equal(ADDRESSES[3], `The previous neighbor of last element should be ${ADDRESSES[3]}!`);               
            });

            it('finds the correct neighbor for last element in NEXT direction', async function() {
                const [nodeExists, neighbor] = await this.linkedList.getAdjacent(ADDRESSES[4], NEXT);
                nodeExists.should.be.equal(true, 'The node should exist!');
                neighbor.should.be.equal(HEAD, `The next neighbor of last element should be HEAD!`);
            });
        });

        describe('.remove', function() {
            it('removes the first element correctly', async function() {
                await this.linkedList.remove(ADDRESSES[0]);
                await sizeShouldBe(this.linkedList, 4);

                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[0]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of deleted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of deleted node should be HEAD!');

                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(HEAD);
                nodeExists.should.be.equal(true, 'The head node should still exist!');
                prevNode.should.be.equal(ADDRESSES[4], `The previous node of HEAD should be ${ADDRESSES[4]}!`);
                nextNode.should.be.equal(ADDRESSES[1], `The next node of HEAD should be ${ADDRESSES[1]}!`);

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(ADDRESSES[1]);
                node2Exists.should.be.equal(true, 'The next node should still exist!');
                prev2Node.should.be.equal(HEAD, 'The previous node of next node should be HEAD!');
                next2Node.should.be.equal(ADDRESSES[2], `The next node of next node should be ${ADDRESSES[2]}!`);
            });

            it('removes the middle element correctly', async function() {
                await this.linkedList.remove(ADDRESSES[2]);
                await sizeShouldBe(this.linkedList, 4);

                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[2]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of deleted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of deleted node should be HEAD!');

                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[1]);
                nodeExists.should.be.equal(true, 'The previous node should still exist!');
                prevNode.should.be.equal(ADDRESSES[0], `The previous node of previous node should be ${ADDRESSES[0]}!`);
                nextNode.should.be.equal(ADDRESSES[3], `The next node of previous node should be ${ADDRESSES[3]}!`);

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(ADDRESSES[3]);
                node2Exists.should.be.equal(true, 'The next node should still exist!');
                prev2Node.should.be.equal(ADDRESSES[1], `The previous node of next node should be ${ADDRESSES[1]}!`);
                next2Node.should.be.equal(ADDRESSES[4], `The next node of next node should be ${ADDRESSES[4]}!`);
            });

            it('removes the last element correctly', async function() {
                await this.linkedList.remove(ADDRESSES[4]);
                await sizeShouldBe(this.linkedList, 4);

                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[4]);
                otherNodeExists.should.be.equal(false, 'The non-inserted node should not exist!');
                prevOtherNode.should.be.equal(HEAD, 'The previous node of deleted node should be HEAD!');
                nextOtherNode.should.be.equal(HEAD, 'The next node of deleted node should be HEAD!');

                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[3]);
                nodeExists.should.be.equal(true, 'The previous node should still exist!');
                prevNode.should.be.equal(ADDRESSES[2], `The previous node of previous node should be ${ADDRESSES[2]}!`);
                nextNode.should.be.equal(HEAD, `The next node of previous node should be HEAD!`);

                const [node2Exists, prev2Node, next2Node] = await this.linkedList.getNode(HEAD);
                node2Exists.should.be.equal(true, 'The next node should still exist!');
                prev2Node.should.be.equal(ADDRESSES[3], `The previous node of next node should be ${ADDRESSES[3]}!`);
                next2Node.should.be.equal(ADDRESSES[0], `The next node of next node should be ${ADDRESSES[0]}!`);
            });
        });

        describe('.push', function() {
            it('pushes correctly', async function() {
                await this.linkedList.push(ADDRESSES[5], NEXT);
                await this.linkedList.push(ADDRESSES[6], PREV);
                await this.linkedList.push(ADDRESSES[7], NEXT);
                await sizeShouldBe(this.linkedList, 8);

                const [otherNodeExists, prevOtherNode, nextOtherNode] = await this.linkedList.getNode(ADDRESSES[6]);
                otherNodeExists.should.be.equal(true, 'The pushed node should exist!');
                prevOtherNode.should.be.equal(
                    ADDRESSES[4],
                    `The previous node of pushed node in PREV direction should be ${ADDRESSES[4]}!`
                );
                nextOtherNode.should.be.equal(HEAD, 'The next node of pushed node in PREV direction should be HEAD!');

                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(ADDRESSES[7]);
                nodeExists.should.be.equal(true, 'The pushed node should exist!');
                prevNode.should.be.equal(HEAD, 'The previous node of pushed node in PREV direction should be HEAD!');
                nextNode.should.be.equal(
                    ADDRESSES[5],
                    `The next node of pushed node in NEXT direction should be ${ADDRESSES[5]}!`
                );
            });
        });

        describe('.pop', function() {
            it('pops correctly', async function() {
                await this.linkedList.pop(NEXT);
                await this.linkedList.pop(PREV);
                await sizeShouldBe(this.linkedList, 3);

                const [nodeExists, prevNode, nextNode] = await this.linkedList.getNode(HEAD);
                nodeExists.should.be.equal(true, 'The pushed node should exist!');
                prevNode.should.be.equal(
                    ADDRESSES[3],
                    `The previous node of HEAD should be ${ADDRESSES[3]}!`
                );
                nextNode.should.be.equal(
                    ADDRESSES[1],
                    `The next node of HEAD should be ${ADDRESSES[1]}!`
                );
            });
        });
    });
});