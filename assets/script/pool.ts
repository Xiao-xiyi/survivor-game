import { _decorator, Component, instantiate, isValid, Node, Prefab } from 'cc';
const _map: Map<string, Node[]> = new Map()
// 从池里取一个节点出来
export function getNode(Prefab: Prefab): Node {
    const name = Prefab.name
    //判断是否有这个预制体，并且对象池里还有闲置节点
    if (_map.has(name) && _map.get(name)!.length > 0) {
        const node = _map.get(name)!.pop()!
        return node
    }
    return instantiate(Prefab)
}
// 把一个节点放回池里（回收）
export function putNode(node: Node): void {
    // 如果节点已经被销毁了，就不回收
    if (!node || !node.isValid) return
    //名字为节点名字
    const name = node.name
    //从父节点移走
    node.removeFromParent()
    //关闭节点
    node.active = false
    //确认这个预制体在_map的对应数组里如果没有就添加进去
    if (!_map.has(name)) _map.set(name, [])
    //把节点放进对象池里
    _map.get(name)!.push(node)

}
//场景切换时清空对象池
export function clearPool(): void {
    _map.forEach((nodes) => {
        // 遍历每个数组，把里面的节点销毁
        nodes.forEach((n) => {
            if (n && n.isValid) n.destroy()
        })
    })
    _map.clear()
}




