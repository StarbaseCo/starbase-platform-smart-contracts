const LinkedListMock = artifacts.require('LinkedListMock.sol')

const { constants } = require('openzeppelin-test-helpers')

const HEAD = constants.ZERO_ADDRESS
const PREV = false
const NEXT = true

const sizeShouldBe = async (linkedList, expectedSize) => {
  const size = (await linkedList.sizeOf()).toNumber()

  size.should.be.equal(
    expectedSize,
    `The size of the linked list should be ${expectedSize}!`
  )
}

const getAdjacent = async (node, direction) => {
  const result = await this.linkedList.getAdjacent(node, direction)

  const nodeExists = result['0']
  const neighbor = result['1']

  return [nodeExists, neighbor]
}

const getNode = async node => {
  const result = await this.linkedList.getNode(node)

  const nodeExists = result['0']
  const prevNode = result['1']
  const nextNode = result['2']

  return [nodeExists, prevNode, nextNode]
}

contract(
  'LinkedListMock',
  ([acc1, acc2, acc3, acc4, acc5, acc6, acc7, acc8]) => {
    beforeEach(async () => {
      this.linkedList = await LinkedListMock.new()
    })

    describe('the list is empty', () => {
      describe('.listExists', () => {
        it('returns false', async () => {
          const listExists = await this.linkedList.listExists()
          listExists.should.be.equal(
            false,
            'The list is empty so listExists should be false!'
          )
        })
      })

      describe('.sizeOf ', () => {
        it('returns 0', async () => {
          await sizeShouldBe(this.linkedList, 0)
        })
      })

      describe('.insert', () => {
        it('inserts correctly', async () => {
          await this.linkedList.insert(HEAD, acc1, NEXT)

          const listExists = await this.linkedList.listExists()
          listExists.should.be.equal(
            true,
            'The list has one element so listExists should be true!'
          )

          await sizeShouldBe(this.linkedList, 1)

          const nodeExists = await this.linkedList.nodeExists(acc1)
          nodeExists.should.be.equal(
            true,
            'The inserted node should exist after insertion!'
          )
        })
      })
    })

    describe('the list is non-empty', () => {
      beforeEach(async () => {
        await this.linkedList.insert(HEAD, acc1, NEXT)
        await this.linkedList.insert(acc1, acc2, NEXT)
        await this.linkedList.insert(acc2, acc3, NEXT)
        await this.linkedList.insert(acc3, acc4, NEXT)
        await this.linkedList.insert(acc4, acc5, NEXT)
      })

      describe('.insert', () => {
        it('inserts correctly at beginning', async () => {
          await this.linkedList.insert(acc1, acc6, PREV)
          await sizeShouldBe(this.linkedList, 6)

          const [nodeExists, prevNode, nextNode] = await getNode(acc6)

          nodeExists.should.be.equal(
            true,
            'The inserted node should exist after insertion!'
          )
          prevNode.should.be.equal(HEAD, 'The previous node should be HEAD!')
          nextNode.should.be.equal(acc1, `The next node should be ${acc1}!`)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc8
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of non-inserted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of non-inserted node should be HEAD!'
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(acc1)
          node2Exists.should.be.equal(
            true,
            'The referenced node should still exist after insertion!'
          )
          prev2Node.should.be.equal(
            acc6,
            `The previous node of reference should be ${acc6}!`
          )
          next2Node.should.be.equal(
            acc2,
            `The next node of reference should be ${acc2}!`
          )
        })

        it('inserts correctly in the middle', async () => {
          await this.linkedList.insert(acc3, acc6, NEXT)
          await sizeShouldBe(this.linkedList, 6)

          const [nodeExists, prevNode, nextNode] = await getNode(acc6)
          nodeExists.should.be.equal(
            true,
            'The inserted node should exist after insertion!'
          )
          prevNode.should.be.equal(acc3, `The previous node should be ${acc3}!`)
          nextNode.should.be.equal(acc4, `The previous node should be ${acc4}!`)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc8
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of non-inserted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of non-inserted node should be HEAD!'
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(acc3)
          node2Exists.should.be.equal(
            true,
            'The referenced node should still exist after insertion!'
          )
          prev2Node.should.be.equal(
            acc2,
            `The previous node of reference should be ${acc2}!`
          )
          next2Node.should.be.equal(
            acc6,
            `The next node of reference should be ${acc6}!`
          )
        })

        it('inserts correctly at end', async () => {
          await this.linkedList.insert(acc5, acc6, NEXT)
          await sizeShouldBe(this.linkedList, 6)

          const [nodeExists, prevNode, nextNode] = await getNode(acc6)
          nodeExists.should.be.equal(
            true,
            'The inserted node should exist after insertion!'
          )
          prevNode.should.be.equal(acc5, `The previous node should be ${acc1}!`)
          nextNode.should.be.equal(HEAD, 'The next node should be HEAD!')

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc8
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of non-inserted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of non-inserted node should be HEAD!'
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(acc5)
          node2Exists.should.be.equal(
            true,
            'The referenced node should still exist after insertion!'
          )
          prev2Node.should.be.equal(
            acc4,
            `The previous node of reference should be ${acc4}!`
          )
          next2Node.should.be.equal(
            acc6,
            `The next node of reference should be ${acc6}!`
          )
        })
      })

      describe('.getAdjacent', () => {
        it('finds the correct neighbor for first element in PREV direction', async () => {
          const [nodeExists, neighbor] = await getAdjacent(acc1, PREV)
          nodeExists.should.be.equal(true, 'The node should exist!')
          neighbor.should.be.equal(
            HEAD,
            `The previous neighbor of first element should be HEAD!`
          )
        })

        it('finds the correct neighbor for first element in NEXT direction', async () => {
          const [nodeExists, neighbor] = await getAdjacent(acc1, NEXT)
          nodeExists.should.be.equal(true, 'The node should exist!')
          neighbor.should.be.equal(
            acc2,
            `The next neighbor of first element should be ${acc2}!`
          )
        })

        it('finds the correct neighbor for last element in PREV direction', async () => {
          const [nodeExists, neighbor] = await getAdjacent(acc5, PREV)
          nodeExists.should.be.equal(true, 'The node should exist!')
          neighbor.should.be.equal(
            acc4,
            `The previous neighbor of last element should be ${acc4}!`
          )
        })

        it('finds the correct neighbor for last element in NEXT direction', async () => {
          const [nodeExists, neighbor] = await getAdjacent(acc5, NEXT)
          nodeExists.should.be.equal(true, 'The node should exist!')
          neighbor.should.be.equal(
            HEAD,
            `The next neighbor of last element should be HEAD!`
          )
        })
      })

      describe('.remove', () => {
        it('removes the first element correctly', async () => {
          await this.linkedList.remove(acc1)
          await sizeShouldBe(this.linkedList, 4)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc1
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of deleted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of deleted node should be HEAD!'
          )

          const [nodeExists, prevNode, nextNode] = await getNode(HEAD)
          nodeExists.should.be.equal(true, 'The head node should still exist!')
          prevNode.should.be.equal(
            acc5,
            `The previous node of HEAD should be ${acc5}!`
          )
          nextNode.should.be.equal(
            acc2,
            `The next node of HEAD should be ${acc2}!`
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(acc2)
          node2Exists.should.be.equal(true, 'The next node should still exist!')
          prev2Node.should.be.equal(
            HEAD,
            'The previous node of next node should be HEAD!'
          )
          next2Node.should.be.equal(
            acc3,
            `The next node of next node should be ${acc3}!`
          )
        })

        it('removes the middle element correctly', async () => {
          await this.linkedList.remove(acc3)
          await sizeShouldBe(this.linkedList, 4)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc3
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of deleted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of deleted node should be HEAD!'
          )

          const [nodeExists, prevNode, nextNode] = await getNode(acc2)
          nodeExists.should.be.equal(
            true,
            'The previous node should still exist!'
          )
          prevNode.should.be.equal(
            acc1,
            `The previous node of previous node should be ${acc1}!`
          )
          nextNode.should.be.equal(
            acc4,
            `The next node of previous node should be ${acc4}!`
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(acc4)
          node2Exists.should.be.equal(true, 'The next node should still exist!')
          prev2Node.should.be.equal(
            acc2,
            `The previous node of next node should be ${acc2}!`
          )
          next2Node.should.be.equal(
            acc5,
            `The next node of next node should be ${acc5}!`
          )
        })

        it('removes the last element correctly', async () => {
          await this.linkedList.remove(acc5)
          await sizeShouldBe(this.linkedList, 4)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc5
          )
          otherNodeExists.should.be.equal(
            false,
            'The non-inserted node should not exist!'
          )
          prevOtherNode.should.be.equal(
            HEAD,
            'The previous node of deleted node should be HEAD!'
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of deleted node should be HEAD!'
          )

          const [nodeExists, prevNode, nextNode] = await getNode(acc4)
          nodeExists.should.be.equal(
            true,
            'The previous node should still exist!'
          )
          prevNode.should.be.equal(
            acc3,
            `The previous node of previous node should be ${acc3}!`
          )
          nextNode.should.be.equal(
            HEAD,
            `The next node of previous node should be HEAD!`
          )

          const [node2Exists, prev2Node, next2Node] = await getNode(HEAD)
          node2Exists.should.be.equal(true, 'The next node should still exist!')
          prev2Node.should.be.equal(
            acc4,
            `The previous node of next node should be ${acc4}!`
          )
          next2Node.should.be.equal(
            acc1,
            `The next node of next node should be ${acc1}!`
          )
        })
      })

      describe('.push', () => {
        it('pushes correctly', async () => {
          await this.linkedList.push(acc6, NEXT)
          await this.linkedList.push(acc7, PREV)
          await this.linkedList.push(acc8, NEXT)
          await sizeShouldBe(this.linkedList, 8)

          const [otherNodeExists, prevOtherNode, nextOtherNode] = await getNode(
            acc7
          )
          otherNodeExists.should.be.equal(true, 'The pushed node should exist!')
          prevOtherNode.should.be.equal(
            acc5,
            `The previous node of pushed node in PREV direction should be ${acc5}!`
          )
          nextOtherNode.should.be.equal(
            HEAD,
            'The next node of pushed node in PREV direction should be HEAD!'
          )

          const [nodeExists, prevNode, nextNode] = await getNode(acc8)
          nodeExists.should.be.equal(true, 'The pushed node should exist!')
          prevNode.should.be.equal(
            HEAD,
            'The previous node of pushed node in PREV direction should be HEAD!'
          )
          nextNode.should.be.equal(
            acc6,
            `The next node of pushed node in NEXT direction should be ${acc6}!`
          )
        })
      })

      describe('.pop', () => {
        it('pops correctly', async () => {
          await this.linkedList.pop(NEXT)
          await this.linkedList.pop(PREV)
          await sizeShouldBe(this.linkedList, 3)

          const [nodeExists, prevNode, nextNode] = await getNode(HEAD)
          nodeExists.should.be.equal(true, 'The pushed node should exist!')
          prevNode.should.be.equal(
            acc4,
            `The previous node of HEAD should be ${acc4}!`
          )
          nextNode.should.be.equal(
            acc2,
            `The next node of HEAD should be ${acc2}!`
          )
        })
      })
    })
  }
)
