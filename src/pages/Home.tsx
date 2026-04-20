import { Link } from 'react-router-dom'

export default function Home() {
  return (
    <div>
      <div className="card">
        <h1>バンドの練習日程を決める</h1>
        <p>
          開催日の候補レンジ（2〜4週間）とパスワードを決めて募集回を作成、メンバーに共有してください。
          回答が集まると、楽器バランスが良い日を自動で上位に表示します。
        </p>
        <p>
          曲決めも同じページで。Last.fm のランキングから拾ったり、YouTubeリンクを貼ってピック＆投票できます。
        </p>
        <Link to="/create" className="btn" style={{ display: 'inline-block', marginTop: 8 }}>
          募集回を作る
        </Link>
      </div>
      <div className="card">
        <h2>使い方</h2>
        <ol style={{ paddingLeft: 20, margin: 0 }}>
          <li>「募集回を作る」→ 日程レンジ・パスワードを設定</li>
          <li>発行された URL とパスワードをバンドメンバーに共有</li>
          <li>各メンバーがニックネーム・楽器・回答を入力</li>
          <li>ページ下部で候補曲をピック＆投票</li>
        </ol>
      </div>
    </div>
  )
}
